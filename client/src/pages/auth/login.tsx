import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import LandscapeSplitShell from "@/components/user/LandscapeSplitShell";
import "@/styles/user-landscape.css";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { getFullUrl } from "@/lib/queryClient";
import { isGuestLoginAllowed } from "@/lib/shopRoutes";
import { finalizeUserSessionLogin, tryRestoreUserSession } from "@/lib/userLoginAuth";
import { peekSkipLoginBootstrap, shouldSkipLoginBootstrap } from "@/lib/loginSession";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import SimpleInfoPopup from "@/components/customUi/simpleInfoPopup";
import splashDisclaimer from "@assets/user/splash-disclaimer.webp";

type LoginBootstrapPhase = "checking" | "ready";

function hasSocialLoginCallback(search: string): boolean {
  return (
    search.includes("kakao_login") ||
    search.includes("google_login") ||
    search.includes("apple_login") ||
    search.includes("error")
  );
}

function LoginBootstrapLoading() {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#111111] flex items-center justify-center"
      data-testid="login-bootstrap-loading"
    >
      <div className="w-8 h-8 border-2 border-[#CDFF00] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  const [location, setLocation] = useLocation();
  const { setUser } = useUser();
  const { assets } = useUserAssets();
  const guestLoginAllowed = isGuestLoginAllowed(location);
  const skipInitialBootstrap = peekSkipLoginBootstrap();
  const [bootstrapPhase, setBootstrapPhase] = useState<LoginBootstrapPhase>(
    skipInitialBootstrap ? "ready" : "checking",
  );
  const bootstrapStartedRef = useRef(false);
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

  const boxErrorClass = (hasError: boolean) =>
    hasError ? "user-login-box user-login-box--error" : "user-login-box";

  useEffect(() => {
    if (bootstrapStartedRef.current) return;
    bootstrapStartedRef.current = true;

    const search = window.location.search;
    if (hasSocialLoginCallback(search) || shouldSkipLoginBootstrap()) {
      setBootstrapPhase("ready");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await tryRestoreUserSession(setUser, setLocation);
      } catch (error) {
        console.log("[Login] session restore failed:", error);
      } finally {
        if (!cancelled) setBootstrapPhase("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setLocation, setUser]);

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

      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: "게스트 로그인에 실패했습니다." };

      if (!response.ok) {
        if (savedGuestId && response.status >= 500) {
          localStorage.removeItem("guest_user_id");
        }
        if (data.error === "suspended") {
          setErrors({
            email: "",
            password: "",
            general: data.message || "삭제된 계정입니다. 관리자한테 문의 주세요.",
          });
        } else {
          setErrors({
            email: "",
            password: "",
            general: data.error || data.message || "게스트 로그인에 실패했습니다.",
          });
        }
        return;
      }

      if (data.user?.id) {
        localStorage.setItem("guest_user_id", data.user.id);
      }

      const ok = await finalizeUserSessionLogin(
        data.accessToken,
        data.refreshToken,
        setUser,
        setLocation,
        data.user ?? null,
      );
      if (!ok) {
        setErrors({ email: "", password: "", general: "게스트 로그인 후 사용자 정보를 불러오지 못했습니다." });
      }
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
        oauth_not_configured:
          urlParams.get("provider") === "google"
            ? "구글 로그인이 설정되지 않았습니다. Replit Secrets에 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET을 등록해 주세요."
            : "카카오 로그인이 설정되지 않았습니다. Replit Secrets에 KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET을 등록해 주세요.",
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
      if (needsOnboarding) {
        socialLoginSucceededRef.current = true;
        setLocation(`/social-onboarding?code=${authCode}`, { replace: true });
        return;
      }

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
          const errorData = await tokenResponse.json().catch(() => ({}));
          console.error("토큰 교환 실패:", errorData);
          throw new Error("토큰 교환 실패");
        }

        const { accessToken, refreshToken } = await tokenResponse.json();
        const ok = await finalizeUserSessionLogin(
          accessToken,
          refreshToken,
          setUser,
          setLocation,
        );

        if (ok) {
          socialLoginSucceededRef.current = true;
          return;
        }

        socialLoginSucceededRef.current = false;
        setErrors((prev) => ({
          ...prev,
          general: "로그인 정보를 불러오지 못했습니다. 다시 시도해 주세요.",
        }));
      } catch (error) {
        console.error(`${provider} 로그인 후 처리 실패:`, error);
        setErrors((prev) => ({
          ...prev,
          general: "로그인 처리 중 오류가 발생했습니다.",
        }));
      }
    }
    } finally {
      socialLoginProcessingRef.current = false;
      setIsLoading(false);
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

  const handleKakaoLogin = async () => {
    try {
      deepLinkHandledRef.current = false;
      socialLoginProcessingRef.current = false;
      socialLoginSucceededRef.current = false;
      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();
      const kakaoAuthUrl = getFullUrl(`/api/auth/kakao${isNative ? `?source=capacitor&platform=${platform}` : ""}`);

      if (isNative) {
        try { await Browser.close(); } catch { /* ignore */ }
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

  const handleGoogleLogin = async () => {
    try {
      deepLinkHandledRef.current = false;
      socialLoginProcessingRef.current = false;
      socialLoginSucceededRef.current = false;
      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();
      const googleAuthUrl = getFullUrl(`/api/auth/google${isNative ? `?source=capacitor&platform=${platform}` : ""}`);

      if (isNative) {
        try { await Browser.close(); } catch { /* ignore */ }
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

  const handleAppleLogin = async () => {
    try {
      deepLinkHandledRef.current = false;
      socialLoginProcessingRef.current = false;
      socialLoginSucceededRef.current = false;
      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();
      const appleAuthUrl = getFullUrl(`/api/auth/apple${isNative ? `?source=capacitor&platform=${platform}` : ""}`);

      if (isNative) {
        try { await Browser.close(); } catch { /* ignore */ }
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

      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: "로그인에 실패했습니다." };

      if (response.ok) {
        const ok = await finalizeUserSessionLogin(
          data.accessToken,
          data.refreshToken,
          setUser,
          setLocation,
          data.user ?? null,
        );
        if (!ok) {
          setErrors({
            email: "",
            password: "",
            general: "로그인 후 사용자 정보를 불러오지 못했습니다.",
          });
        }
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

  if (bootstrapPhase === "checking") {
    return <LoginBootstrapLoading />;
  }

  return (
    <>
      <LandscapeSplitShell
        testId="login-page"
        pageClassName="user-landscape-page--login"
        left={
          <div className="user-login-left">
            <div className="user-login-mascot-track" aria-hidden>
              <div className="user-login-mascot-walker">
                <img
                  src={assets.userMascot}
                  alt=""
                  className="user-login-mascot-img"
                  data-testid="img-login-logo"
                />
              </div>
            </div>
            <img
              src={splashDisclaimer}
              alt="15세 이용가 및 재화 안내"
              className="user-landscape-disclaimer"
              data-testid="img-login-disclaimer"
            />
          </div>
        }
        right={
          <form onSubmit={handleSubmit} className="user-login-panel">
            <div className="user-login-fields">
              <div className="user-login-card">
                <div className="user-login-field">
                  <label htmlFor="email" className="user-login-field-label">
                    아이디
                  </label>
                  <input
                    id="email"
                    type="text"
                    data-testid="input-email"
                    placeholder="아이디 입력"
                    value={email}
                    onChange={handleEmailChange}
                    className={boxErrorClass(Boolean(errors.email))}
                    autoComplete="username"
                  />
                  {errors.email ? (
                    <p className="user-login-error user-login-error--card" data-testid="error-email">
                      {errors.email}
                    </p>
                  ) : null}
                </div>

                <div className="user-login-field">
                  <label htmlFor="password" className="user-login-field-label">
                    비밀번호
                  </label>
                  <div className="user-login-box-wrap">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      data-testid="input-password"
                      placeholder="비밀번호 입력"
                      value={password}
                      onChange={handlePasswordChange}
                      className={boxErrorClass(Boolean(errors.password))}
                      style={{ paddingRight: 36 }}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      data-testid="button-toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      className="user-login-box-toggle"
                      aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="user-login-error user-login-error--card" data-testid="error-password">
                      {errors.password}
                    </p>
                  ) : null}
                </div>
              </div>

              {errors.general ? (
                <p className="user-login-error user-login-error--below" data-testid="error-general">
                  {errors.general}
                </p>
              ) : null}

              <div className="user-login-actions">
                <button
                  type="submit"
                  disabled={isLoading}
                  data-testid="button-login"
                  className="user-login-submit"
                >
                  {isLoading ? "로그인 중..." : "로그인"}
                </button>
                <p className="user-login-forgot">
                  <Link href="/forgot-password" data-testid="link-forgot-password">
                    비밀번호를 잊으셨나요?
                  </Link>
                </p>
              </div>
            </div>

            {guestLoginAllowed ? (
              <>
                <div className="user-login-divider" aria-hidden />
                <button
                  type="button"
                  onClick={handleGuestLogin}
                  data-testid="button-guest-login"
                  disabled={isGuestLoading}
                  className="user-login-link"
                >
                  {isGuestLoading ? "로그인 중..." : "게스트로 로그인"}
                </button>
              </>
            ) : null}

            <div className="user-login-divider" aria-hidden />

            <div className="user-login-socials">
              <button
                type="button"
                data-testid="button-kakao-login"
                onClick={handleKakaoLogin}
                className="user-login-social-btn bg-[#FEE500]"
                aria-label="카카오 로그인"
              >
                <img src={assets.kakaoIcon} alt="" />
              </button>
              <button
                type="button"
                data-testid="button-google-login"
                onClick={handleGoogleLogin}
                className="user-login-social-btn bg-white"
                aria-label="구글 로그인"
              >
                <img src={assets.googleIcon} alt="" />
              </button>
              <button
                type="button"
                data-testid="button-apple-login"
                onClick={handleAppleLogin}
                className="user-login-social-btn bg-[#3A383C]"
                aria-label="애플 로그인"
              >
                <img src={assets.appleIcon} alt="" />
              </button>
            </div>

            <div className="user-login-divider" aria-hidden />

            <p className="user-login-signup">
              계정이 없으신가요?{" "}
              <Link href={`/signup${window.location.search}`} data-testid="link-signup">
                신규 회원 가입
              </Link>
            </p>
          </form>
        }
      />

      {showSuspendedPopup && (
        <SimpleInfoPopup
          message="삭제된 계정입니다. 관리자한테 문의 주세요."
          onClose={() => setShowSuspendedPopup(false)}
        />
      )}
    </>
  );
}
