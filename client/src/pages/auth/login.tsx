import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { getFullUrl, apiRequest, resetRefreshCooldown } from "@/lib/queryClient";
import { completeLoginNavigation, DEFAULT_POST_LOGIN_FALLBACK } from "@/lib/appNavigation";
import { isGuestLoginAllowed, isIntroStaffLoginReturn } from "@/lib/shopRoutes";
import { setAccessToken, saveRefreshToken } from "@/lib/tokenManager";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import SimpleInfoPopup from "@/components/customUi/simpleInfoPopup";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { user, setUser, isUserLoaded } = useUser();
  const { assets } = useUserAssets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({
    email: "",
    password: "",
    general: "",
  });
  const [showSuspendedPopup, setShowSuspendedPopup] = useState(false);
  const socialLoginProcessingRef = useRef(false);
  const deepLinkHandledRef = useRef(false);
  const processSocialLoginRef = useRef<(searchParams: string) => Promise<void>>();

  const socialLoginSucceededRef = useRef(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const sessionRedirectDoneRef = useRef(false);

  const showGuestLogin = isGuestLoginAllowed();

  // 공개 홈 소개(/)의 구 회원 로그인 링크 → 관리자 로그인
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (isIntroStaffLoginReturn(params.get("return"))) {
      window.location.replace("/admin/login");
    }
  }, []);

  // 이미 로그인된 회원이 /login 접속 시에만 이동 (게스트·홈페이지 로그인 처리 중 제외)
  useEffect(() => {
    if (
      sessionRedirectDoneRef.current ||
      !isUserLoaded ||
      !user ||
      isGuestLoading ||
      isLoading
    ) {
      return;
    }
    if (user.provider === "guest" && !showGuestLogin) {
      return;
    }
    if (user.provider === "guest" && showGuestLogin) {
      sessionRedirectDoneRef.current = true;
      void completeLoginNavigation(setLocation, DEFAULT_POST_LOGIN_FALLBACK);
      return;
    }
    if (user.provider !== "guest") {
      sessionRedirectDoneRef.current = true;
      void completeLoginNavigation(setLocation, DEFAULT_POST_LOGIN_FALLBACK);
    }
  }, [isUserLoaded, user, isGuestLoading, isLoading, setLocation, showGuestLogin]);

  const handleGuestLogin = async () => {
    if (isGuestLoading || isLoading) return;
    setIsGuestLoading(true);
    setErrors({ email: "", password: "", general: "" });

    try {
      const savedGuestId = localStorage.getItem("guest_user_id");

      const response = await fetch(getFullUrl("/api/guest-login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savedGuestId ? { guestId: savedGuestId } : {}),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "already_logged_in") {
          setErrors({ email: "", password: "", general: "이미 다른 기기에서 로그인 중입니다." });
        } else {
          setErrors({ email: "", password: "", general: data.error || "게스트 로그인에 실패했습니다." });
        }
        return;
      }

      if (data.user?.id) {
        localStorage.setItem("guest_user_id", data.user.id);
      }

      resetRefreshCooldown();
      if (data.accessToken) {
        setAccessToken(data.accessToken);
      }
      if (data.refreshToken) {
        await saveRefreshToken(data.refreshToken);
      }

      if (data.user) {
        setUser(data.user);
      }
      sessionRedirectDoneRef.current = true;
      await completeLoginNavigation(setLocation, DEFAULT_POST_LOGIN_FALLBACK);
    } catch (error) {
      console.error("게스트 로그인 실패:", error);
      setErrors({ email: "", password: "", general: "게스트 로그인 중 오류가 발생했습니다." });
    } finally {
      setIsGuestLoading(false);
    }
  };

  // 소셜 로그인 콜백 처리 함수 (딥링크에서 일회용 코드 수신 후 토큰 교환)
  const processSocialLogin = async (searchParams: string) => {
    if (socialLoginProcessingRef.current || socialLoginSucceededRef.current) {
      console.log("[SocialLogin] 이미 처리 중 또는 성공 완료 - 중복 호출 무시");
      return;
    }
    socialLoginProcessingRef.current = true;
    setIsLoading(true);
    setErrors({ email: "", password: "", general: "" });
    try {
    const urlParams = new URLSearchParams(searchParams);
    const kakaoLogin = urlParams.get("kakao_login");
    const googleLogin = urlParams.get("google_login");
    const appleLogin = urlParams.get("apple_login");
    const error = urlParams.get("error");
    const authCode = urlParams.get("code");

    if (error) {
      if (error === "suspended") {
        setShowSuspendedPopup(true);
        return;
      }
      const errorMessages: Record<string, string> = {
        no_code: "인증 코드가 없습니다.",
        no_token: "인증 토큰이 없습니다.",
        token_exchange_failed: "인증에 실패했습니다.",
        user_info_failed: "사용자 정보를 가져올 수 없습니다.",
        duplicate_login: "이미 다른 곳에서 로그인된 계정입니다.",
        already_logged_in: "이미 다른 기기에서 로그인 중입니다.",
        login_failed: "로그인 처리 중 오류가 발생했습니다.",
      };
      setErrors((prev) => ({
        ...prev,
        general: errorMessages[error] || "로그인에 실패했습니다.",
      }));
      return;
    }

    // 카카오, 구글, 또는 애플 로그인 성공 처리
    const isKakaoSuccess = kakaoLogin === "success" && authCode;
    const isGoogleSuccess = googleLogin === "success" && authCode;
    const isAppleSuccess = appleLogin === "success" && authCode;
    const needsOnboarding = urlParams.get("needs_onboarding") === "true";
    const provider = isKakaoSuccess
      ? "kakao"
      : isGoogleSuccess
        ? "google"
        : isAppleSuccess
          ? "apple"
          : null;

    if (provider && authCode) {
      // 신규 사용자: 추가정보 입력 페이지로 이동 (계정 미생성 상태)
      if (needsOnboarding) {
        socialLoginSucceededRef.current = true;
        setTimeout(() => setLocation(`/social-onboarding?code=${authCode}`, { replace: true }), 0);
        return;
      }

      // 기존 사용자: 토큰 교환 후 로그인
      try {
        const tokenResponse = await fetch(
          getFullUrl(`/api/auth/${provider}/exchange-token`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: authCode }),
          },
        );

        if (!tokenResponse.ok) {
          if (socialLoginSucceededRef.current) {
            return;
          }
          const errorData = await tokenResponse.json().catch(() => ({}));
          console.error("토큰 교환 실패:", errorData);
          throw new Error("토큰 교환 실패");
        }

        const { accessToken, refreshToken } = await tokenResponse.json();

        socialLoginSucceededRef.current = true;

        resetRefreshCooldown();
        setAccessToken(accessToken);
        await saveRefreshToken(refreshToken);

        try {
          const meResponse = await fetch(getFullUrl("/api/users/me"), {
            method: "GET",
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (meResponse.ok) {
            const userData = await meResponse.json();
            let userObj;
            if (userData.success && userData.user) {
              userObj = {
                ...userData.user,
                attendanceRecords: userData.attendanceRecords || [],
              };
            } else {
              userObj = {
                ...userData,
                attendanceRecords: [],
              };
            }
            setUser(userObj);

            await completeLoginNavigation(setLocation, DEFAULT_POST_LOGIN_FALLBACK);
            return;
          }
        } catch (meError) {
          console.error(`[${provider}] /api/users/me 오류:`, meError);
        }

        await completeLoginNavigation(setLocation, DEFAULT_POST_LOGIN_FALLBACK);
        return;
      } catch (error) {
        if (socialLoginSucceededRef.current) {
          return;
        }
        console.error(`${provider} 로그인 후 처리 실패:`, error);
        setErrors((prev) => ({
          ...prev,
          general: "로그인 처리 중 오류가 발생했습니다.",
        }));
      }
    }
    } finally {
      if (!socialLoginSucceededRef.current) {
        socialLoginProcessingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  processSocialLoginRef.current = processSocialLogin;

  // 웹 브라우저 콜백 처리
  useEffect(() => {
    const handleWebCallback = async () => {
      const searchParams = window.location.search;

      if (
        searchParams.includes("kakao_login") ||
        searchParams.includes("google_login") ||
        searchParams.includes("apple_login") ||
        searchParams.includes("error")
      ) {
        window.history.replaceState({}, "", window.location.pathname);
        await processSocialLoginRef.current?.(searchParams);
      }
    };

    handleWebCallback();
  }, []);

  // 네이티브 앱 딥링크 콜백 처리
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: { remove: () => void } | null = null;

    const setupListener = async () => {
      listenerHandle = await App.addListener("appUrlOpen", async (event) => {
        if (deepLinkHandledRef.current) {
          console.log("[SocialLogin] 딥링크 이미 처리됨 - 중복 무시");
          try { await Browser.close(); } catch (e) {}
          return;
        }

        try {
          const url = new URL(event.url);
          const searchParams = url.search;

          if (
            searchParams.includes("kakao_login") ||
            searchParams.includes("google_login") ||
            searchParams.includes("apple_login") ||
            searchParams.includes("error")
          ) {
            deepLinkHandledRef.current = true;
            try { await Browser.close(); } catch (e) {}
            await processSocialLoginRef.current?.(searchParams);
          }
        } catch (error) {
          console.error("딥링크 처리 실패:", error);
        }
      });
    };

    setupListener();

    return () => {
      listenerHandle?.remove();
    };
  }, []);

  // 카카오 로그인 버튼 클릭 핸들러
  const handleKakaoLogin = async () => {
    try {
      deepLinkHandledRef.current = false;
      socialLoginProcessingRef.current = false;
      socialLoginSucceededRef.current = false;
      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();
      const kakaoAuthUrl = getFullUrl(`/api/auth/kakao${isNative ? `?source=capacitor&platform=${platform}` : ''}`);

      if (isNative) {
        try { await Browser.close(); } catch (e) {}
        await Browser.open({ url: kakaoAuthUrl });
      } else {
        window.location.href = kakaoAuthUrl;
      }
    } catch (error) {
      console.error("카카오 로그인 시작 실패:", error);
      setErrors((prev) => ({
        ...prev,
        general: "카카오 로그인을 시작할 수 없습니다.",
      }));
    }
  };

  // 구글 로그인 버튼 클릭 핸들러
  const handleGoogleLogin = async () => {
    try {
      deepLinkHandledRef.current = false;
      socialLoginProcessingRef.current = false;
      socialLoginSucceededRef.current = false;
      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();
      const googleAuthUrl = getFullUrl(`/api/auth/google${isNative ? `?source=capacitor&platform=${platform}` : ''}`);

      if (isNative) {
        try { await Browser.close(); } catch (e) {}
        await Browser.open({ url: googleAuthUrl });
      } else {
        window.location.href = googleAuthUrl;
      }
    } catch (error) {
      console.error("구글 로그인 시작 실패:", error);
      setErrors((prev) => ({
        ...prev,
        general: "구글 로그인을 시작할 수 없습니다.",
      }));
    }
  };

  // 애플 로그인 버튼 클릭 핸들러
  const handleAppleLogin = async () => {
    try {
      deepLinkHandledRef.current = false;
      socialLoginProcessingRef.current = false;
      socialLoginSucceededRef.current = false;
      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();
      const appleAuthUrl = getFullUrl(`/api/auth/apple${isNative ? `?source=capacitor&platform=${platform}` : ''}`);

      if (isNative) {
        try { await Browser.close(); } catch (e) {}
        await Browser.open({ url: appleAuthUrl });
      } else {
        window.location.href = appleAuthUrl;
      }
    } catch (error) {
      console.error("애플 로그인 시작 실패:", error);
      setErrors((prev) => ({
        ...prev,
        general: "애플 로그인을 시작할 수 없습니다.",
      }));
    }
  };
  const validate = () => {
    const newErrors = { email: "", password: "", general: "" };

    if (!email.trim()) newErrors.email = "아이디를 입력해 주세요.";
    if (!password.trim()) newErrors.password = "비밀번호를 입력해 주세요.";

    setErrors(newErrors);
    return !newErrors.email && !newErrors.password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    setErrors({ email: "", password: "", general: "" });

    try {
      const response = await fetch(getFullUrl("/api/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        resetRefreshCooldown();
        setAccessToken(data.accessToken);
        await saveRefreshToken(data.refreshToken);

        try {
          const meResponse = await fetch(getFullUrl("/api/users/me"), {
            method: "GET",
            headers: {
              'Authorization': `Bearer ${data.accessToken}`,
            },
          });

          if (meResponse.ok) {
            const meData = await meResponse.json();
            if (meData.success && meData.user) {
              setUser({
                ...meData.user,
                attendanceRecords: meData.attendanceRecords || [],
              });
            } else {
              setUser({
                ...data.user,
                attendanceRecords: [],
              });
            }
          } else {
            setUser({
              ...data.user,
              attendanceRecords: [],
            });
          }
        } catch {
          setUser({
            ...data.user,
            attendanceRecords: [],
          });
        }

        sessionRedirectDoneRef.current = true;
        await completeLoginNavigation(setLocation, DEFAULT_POST_LOGIN_FALLBACK);
      } else {
        if (data.error === "suspended") {
          setShowSuspendedPopup(true);
        } else {
          setErrors({
            email: "",
            password: "",
            general: data.message || data.error || "로그인에 실패했습니다.",
          });
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      setErrors({
        email: "",
        password: "",
        general: "로그인 중 오류가 발생했습니다. 다시 시도해 주세요.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errors.email || errors.general) {
      setErrors((prev) => ({ ...prev, email: "", general: "" }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errors.password || errors.general) {
      setErrors((prev) => ({ ...prev, password: "", general: "" }));
    }
  };

  return (
    <div className="h-app-screen bg-[#111111] flex">
      <div className="flex-1 flex flex-col px-4 overflow-y-scroll-touch" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }}>
        {/* 로고 */}
        <div
          className="flex justify-center mt-6 mb-12"
          data-testid="logo-container"
        >
          <div className="w-[140px] h-[220px] flex items-center justify-center">
            <img
              src={assets.userMascot}
              alt="PPAMONG 로고"
              className="w-full h-full object-contain"
              data-testid="img-login-logo"
            />
          </div>
        </div>

        {/* 로그인 폼 */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col justify-between"
        >
          {/* 입력 필드 */}
          <div className="space-y-6">
            {/* 아이디 */}
            <div className="space-y-2.5">
              <Label
                htmlFor="email"
                className="text-[#BFBFBF] text-sm font-medium px-1"
              >
                아이디
              </Label>
              <div className="relative flex items-center">
                <Mail
                  className="absolute left-2 w-5 h-5 text-[#4D4B4E]"
                  data-testid="icon-email"
                />
                <Input
                  id="email"
                  type="text"
                  data-testid="input-email"
                  placeholder="아이디를 입력해 주세요"
                  value={email}
                  onChange={handleEmailChange}
                  className={`w-full h-12 bg-transparent border-0 border-b text-white placeholder:text-[#4D4B4E] rounded-none pl-9 pr-3 focus:outline-none focus:ring-0 focus-visible:ring-0 ${
                    errors.email || errors.general
                      ? "border-b-[#E75C5D] focus-visible:border-b-[#E75C5D]"
                      : "border-b-[#373539] focus-visible:border-b-[#BFBFBF]"
                  }`}
                />
              </div>
              {errors.email && (
                <p
                  className="text-[#E75C5D] text-[16px] px-1"
                  data-testid="error-email"
                >
                  {errors.email}
                </p>
              )}
            </div>

            {/* 비밀번호 */}
            <div className="space-y-2.5">
              <Label
                htmlFor="password"
                className="text-[#BFBFBF] text-sm font-medium px-1"
              >
                비밀번호
              </Label>
              <div className="relative flex items-center">
                <Lock
                  className="absolute left-2 w-5 h-5 text-[#4D4B4E]"
                  data-testid="icon-password"
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  data-testid="input-password"
                  placeholder="비밀번호를 입력해 주세요"
                  value={password}
                  onChange={handlePasswordChange}
                  className={`w-full h-12 bg-transparent border-0 border-b text-white placeholder:text-[#4D4B4E] rounded-none pl-9 pr-12 focus:outline-none focus:ring-0 focus-visible:ring-0 ${
                    errors.password || errors.general
                      ? "border-b-[#E75C5D] focus-visible:border-b-[#E75C5D]"
                      : "border-b-[#373539] focus-visible:border-b-[#BFBFBF]"
                  }`}
                />
                <button
                  type="button"
                  data-testid="button-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#D5D5D5] transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p
                  className="text-[#E75C5D] text-[16px] px-1"
                  data-testid="error-password"
                >
                  {errors.password}
                </p>
              )}
              {errors.general && (
                <p
                  className="text-[#E75C5D] text-[16px] px-1"
                  data-testid="error-general"
                >
                  {errors.general}
                </p>
              )}
            </div>

            <div className="flex justify-center">
              <Link
                href="/forgot-password"
                className="text-sm text-[#555555] hover:text-white transition-colors underline"
                data-testid="link-forgot-password"
              >
                비밀번호를 잊으셨나요?
              </Link>
            </div>
          </div>

          {/* 게스트 로그인 및 소셜 로그인 */}
          <div className="flex flex-col">
            <div className="mb-4 space-y-4">
              {showGuestLogin && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleGuestLogin}
                    data-testid="button-guest-login"
                    disabled={isGuestLoading}
                    className="text-sm text-[#BFBFBF] hover:text-white transition-colors underline disabled:opacity-50"
                  >
                    {isGuestLoading ? "로그인 중..." : "게스트로 로그인"}
                  </button>
                </div>
              )}

              {/* 소셜 로그인 버튼 */}
              <div className="flex items-center justify-center gap-4">
                {/* 카카오 로그인 - 노란색 원형 버튼 */}
                <button
                  type="button"
                  data-testid="button-kakao-login"
                  onClick={handleKakaoLogin}
                  className="w-9 h-9 rounded-full bg-[#FEE500] flex items-center justify-center hover:opacity-90 transition-opacity"
                  aria-label="카카오 로그인"
                >
                  <img
                    src={assets.kakaoIcon}
                    className="w-6 h-6 object-contain"
                  ></img>
                </button>

                {/* 애플 로그인 - 원형 버튼 */}
                <button
                  type="button"
                  data-testid="button-apple-login"
                  onClick={handleAppleLogin}
                  className="w-9 h-9 rounded-full bg-[#3A383C] flex items-center justify-center hover:opacity-90 transition-opacity"
                  aria-label="애플 로그인"
                >
                  <img
                    src={assets.appleIcon}
                    className="w-6 h-6 object-contain"
                  ></img>
                </button>

                {/* 구글 로그인 - 흰색 원형 버튼 */}
                <button
                  type="button"
                  data-testid="button-google-login"
                  onClick={handleGoogleLogin}
                  className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:opacity-90 transition-opacity"
                  aria-label="구글 로그인"
                >
                  <img
                    src={assets.googleIcon}
                    className="w-6 h-6 object-contain"
                  ></img>
                </button>
              </div>
            </div>

            <p className="text-center text-sm mb-4 gap-[6px] flex justify-center">
              <span className="text-[#BFBFBF]">계정이 없으신가요? </span>
              <Link
                href={`/signup${window.location.search}`}
                className="text-[#CDFF00] font-semibold hover:underline"
                data-testid="link-signup"
              >
                회원가입
              </Link>
            </p>
            {/* 로그인 버튼 - form 안에 위치 */}
            <Button
              type="submit"
              disabled={isLoading}
              data-testid="button-login"
              className="w-full h-12 bg-[#CDFF00] active:bg-[#C8D48D] border border-[#CDFF00] text-black font-semibold text-base rounded-lg"
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </div>
        </form>
      </div>

      {showSuspendedPopup && (
        <SimpleInfoPopup
          message="삭제된 계정입니다. 관리자한테 문의 주세요."
          onClose={() => setShowSuspendedPopup(false)}
        />
      )}

    </div>
  );
}
