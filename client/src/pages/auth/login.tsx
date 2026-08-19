import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import LandscapeSplitShell from "@/components/user/LandscapeSplitShell";
import LoginMascotRunner from "@/components/user/LoginMascotRunner";
import AuthPanelModal from "@/components/user/AuthPanelModal";
import FindUsernameForm from "@/components/user/FindUsernameForm";
import FindPasswordForm from "@/components/user/FindPasswordForm";
import "@/styles/user-landscape.css";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useAndroidImmersiveMode } from "@/hooks/useAndroidImmersiveMode";
import { getFullUrl } from "@/lib/queryClient";
import { isGuestLoginAllowed } from "@/lib/shopRoutes";
import { finalizeUserSessionLogin, tryRestoreUserSession } from "@/lib/userLoginAuth";
import { peekSkipLoginBootstrap, shouldSkipLoginBootstrap, consumeSignupLoginPrefill } from "@/lib/loginSession";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import SimpleInfoPopup from "@/components/customUi/simpleInfoPopup";
import splashDisclaimer from "@assets/user/splash-disclaimer.webp";

type LoginBootstrapPhase = "checking" | "ready";
type LoginLeftPanel = "find-id" | "find-password";

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
  const [, setLocation] = useLocation();
  const { setUser } = useUser();
  const { assets } = useUserAssets();
  useAndroidImmersiveMode();
  const guestLoginAllowed = isGuestLoginAllowed(window.location.search);
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
  const [sessionActivePopup, setSessionActivePopup] = useState<{
    canForceLogin: boolean;
    message: string;
  } | null>(null);
  const socialLoginProcessingRef = useRef(false);
  const deepLinkHandledRef = useRef(false);
  const processSocialLoginRef = useRef<(searchParams: string) => Promise<void>>();

  const socialLoginSucceededRef = useRef(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [awaitingLoginAfterSignup, setAwaitingLoginAfterSignup] = useState(false);
  const [leftPanel, setLeftPanel] = useState<LoginLeftPanel | null>(null);

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

  useEffect(() => {
    const prefill = consumeSignupLoginPrefill();
    if (!prefill) return;
    setEmail(prefill.username);
    setPassword(prefill.password);
    setAwaitingLoginAfterSignup(true);
  }, []);

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
      if (error === "already_logged_in" || error === "duplicate_login") {
        setSessionActivePopup({
          canForceLogin: false,
          message:
            "이미 다른 기기에서 로그인되어 있습니다.\n다른 기기에서 로그아웃하거나,\n본인이 아니면 비밀번호를 변경해 주세요.",
        });
        return;
      }
      const errorMessages: Record<string, string> = {
        no_code: "인증 코드가 없습니다.",
        no_token: "인증 토큰이 없습니다.",
        token_exchange_failed: "인증에 실패했습니다.",
        user_info_failed: "사용자 정보를 가져올 수 없습니다.",
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

  const submitPasswordLogin = async (forceLogin: boolean) => {
    setIsLoading(true);
    setAwaitingLoginAfterSignup(false);
    setErrors({ email: "", password: "", general: "" });

    try {
      const response = await fetch(getFullUrl("/api/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: email,
          password,
          forceLogin: forceLogin || undefined,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: "로그인에 실패했습니다." };

      if (response.ok) {
        setSessionActivePopup(null);
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
      } else if (
        response.status === 409 ||
        data.code === "SESSION_ACTIVE" ||
        data.error === "SESSION_ACTIVE"
      ) {
        setSessionActivePopup({
          canForceLogin: data.canForceLogin !== false,
          message:
            data.message ||
            "이미 다른 기기에서 로그인되어 있습니다.\n본인이 아닌 경우 비밀번호를 변경해 주세요.",
        });
      } else if (data.error === "suspended") {
        setShowSuspendedPopup(true);
      } else {
        setErrors({
          email: "",
          password: "",
          general: data.message || data.error || "로그인에 실패했습니다.",
        });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    await submitPasswordLogin(false);
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
          <div className="user-login-left-shell">
            <form onSubmit={handleSubmit} className="user-login-panel user-login-panel--core">
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

                {awaitingLoginAfterSignup ? (
                  <p className="user-login-hint" data-testid="text-signup-login-hint">
                    회원가입이 완료되었습니다. 로그인해 주세요.
                  </p>
                ) : null}

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
                  <div className="user-login-recovery">
                    <button
                      type="button"
                      className="user-login-recovery-btn"
                      data-testid="link-find-username"
                      onClick={() => setLeftPanel("find-id")}
                    >
                      아이디 찾기
                    </button>
                    <span className="user-login-recovery-sep" aria-hidden>
                      ·
                    </span>
                    <button
                      type="button"
                      className="user-login-recovery-btn"
                      data-testid="link-find-password"
                      onClick={() => setLeftPanel("find-password")}
                    >
                      비밀번호 찾기
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <img
              src={splashDisclaimer}
              alt="15세 이용가 및 재화 안내"
              className="user-landscape-disclaimer user-login-disclaimer"
              data-testid="img-login-disclaimer"
            />

            <AuthPanelModal
              anchor="left"
              open={leftPanel !== null}
              title={leftPanel === "find-id" ? "아이디 찾기" : "비밀번호 찾기"}
              onClose={() => setLeftPanel(null)}
              testId={leftPanel === "find-id" ? "find-username-modal" : "find-password-modal"}
            >
              {leftPanel === "find-id" ? (
                <FindUsernameForm
                  onClose={() => setLeftPanel(null)}
                  onUseUsername={(username) => {
                    setEmail(username);
                    setErrors((prev) => ({ ...prev, email: "", general: "" }));
                  }}
                />
              ) : leftPanel === "find-password" ? (
                <FindPasswordForm onClose={() => setLeftPanel(null)} />
              ) : null}
            </AuthPanelModal>
          </div>
        }
        right={
          <div className="user-login-right-shell">
            <div className="user-login-right-brand">
              <LoginMascotRunner />
            </div>

            <div className="user-login-panel user-login-panel--extras">
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
            </div>
          </div>
        }
      />

      {showSuspendedPopup && (
        <SimpleInfoPopup
          message="삭제된 계정입니다. 관리자한테 문의 주세요."
          onClose={() => setShowSuspendedPopup(false)}
        />
      )}

      {sessionActivePopup && (
        <>
          <div className="fixed inset-0 bg-[#000000CC] z-[70]" />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] bg-[#2F2F2F] shadow-[0_8px_36px_rgba(0,0,0,0.16)] rounded-[8px] flex flex-col items-center p-[20px_20px_16px] gap-3 z-[75]"
            data-testid="popup-session-active"
          >
            <p className="w-full text-center text-[#E9E9E9] font-[Pretendard] font-normal text-[15px] leading-[140%] tracking-[-0.025em] whitespace-pre-line">
              {sessionActivePopup.message}
            </p>
            <div className="w-full flex flex-col gap-2">
              <button
                type="button"
                data-testid="button-session-active-password"
                className="w-full h-[40px] bg-[#CCF501] active:bg-[#C8D48D] border border-[#CDFF00] rounded-[6px] font-[Pretendard] font-semibold text-[14px] text-[#111111]"
                onClick={() => {
                  setSessionActivePopup(null);
                  setLeftPanel("find-password");
                }}
              >
                비밀번호 변경
              </button>
              {sessionActivePopup.canForceLogin ? (
                <button
                  type="button"
                  data-testid="button-session-active-force"
                  disabled={isLoading}
                  className="w-full h-[40px] bg-[#3A3A3A] active:bg-[#4A4A4A] border border-[#555] rounded-[6px] font-[Pretendard] font-semibold text-[14px] text-[#E9E9E9] disabled:opacity-60"
                  onClick={() => {
                    void submitPasswordLogin(true);
                  }}
                >
                  {isLoading ? "로그인 중..." : "이 기기로 강제 로그인"}
                </button>
              ) : null}
              <button
                type="button"
                data-testid="button-session-active-close"
                className="w-full h-[36px] font-[Pretendard] font-medium text-[13px] text-[#AAAAAA]"
                onClick={() => setSessionActivePopup(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
