import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import LandscapeSplitShell from "@/components/user/LandscapeSplitShell";
import "@/styles/user-landscape.css";
import { useUserAssets } from "@/contexts/UserAssetContext";
import Popup from "@/components/customUi/infoPopup";
import SignupPanelModal from "@/components/user/SignupPanelModal";
import { Term } from "@shared/schema";
import { getFullUrl } from "@/lib/queryClient";
import { stashSignupLoginPrefill } from "@/lib/loginSession";
import splashDisclaimer from "@assets/user/splash-disclaimer.webp";

type SignupPanelModalType = "service" | "privacy" | "disclaimer";

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { assets } = useUserAssets();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const [emailDuplicateChecked, setEmailDuplicateChecked] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [panelModal, setPanelModal] = useState<SignupPanelModalType | null>(null);

  const [showVerificationInput, setShowVerificationInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationTimer, setVerificationTimer] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  const [serviceTerm, setServiceTerm] = useState<Term | null>(null);
  const [privacyTerm, setPrivacyTerm] = useState<Term | null>(null);

  const [errors, setErrors] = useState({
    username: "",
    name: "",
    password: "",
    confirmPassword: "",
    email: "",
    phone: "",
    referralCode: "",
    terms: "",
  });
  const [touched, setTouched] = useState({
    username: false,
    name: false,
    password: false,
    confirmPassword: false,
    email: false,
    phone: false,
    referralCode: false,
  });

  const boxErrorClass = (hasError: boolean) =>
    hasError ? "user-login-box user-login-box--error" : "user-login-box";

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const [serviceRes, privacyRes] = await Promise.all([
          fetch(getFullUrl("/api/terms/type/service")),
          fetch(getFullUrl("/api/terms/type/privacy")),
        ]);

        const serviceData = await serviceRes.json();
        const privacyData = await privacyRes.json();

        setServiceTerm(serviceData);
        setPrivacyTerm(privacyData);
      } catch (error) {
        console.error("약관 로드 실패:", error);
      }
    };

    void fetchTerms();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (verificationTimer > 0) {
      interval = setInterval(() => {
        setVerificationTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [verificationTimer]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const sendVerificationCode = async () => {
    if (!phone.trim()) {
      setErrors((prev) => ({ ...prev, phone: "전화번호를 입력해 주세요." }));
      return;
    }

    const cleanPhone = phone.replace(/-/g, "");
    if (!/^01[0-9]{8,9}$/.test(cleanPhone)) {
      setErrors((prev) => ({
        ...prev,
        phone: "올바른 전화번호 형식이 아닙니다.",
      }));
      return;
    }

    setIsSendingCode(true);
    try {
      const response = await fetch(getFullUrl("/api/phone/send-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowVerificationInput(true);
        setVerificationTimer(data.expiresIn || 180);
        setVerificationCode("");
        setIsPhoneVerified(false);
        setErrors((prev) => ({ ...prev, phone: "" }));
      } else {
        setErrors((prev) => ({
          ...prev,
          phone: data.error || "인증번호 전송에 실패했습니다.",
        }));
      }
    } catch {
      setErrors((prev) => ({
        ...prev,
        phone: "인증번호 전송 중 오류가 발생했습니다.",
      }));
    } finally {
      setIsSendingCode(false);
    }
  };

  const verifyCode = async () => {
    if (!verificationCode.trim()) {
      setErrors((prev) => ({ ...prev, phone: "인증번호를 입력해 주세요." }));
      return;
    }

    const cleanPhone = phone.replace(/-/g, "");
    setIsVerifying(true);

    try {
      const response = await fetch(getFullUrl("/api/phone/verify-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, code: verificationCode }),
      });

      const data = await response.json();

      if (response.ok && data.verified) {
        setIsPhoneVerified(true);
        setVerificationTimer(0);
        setErrors((prev) => ({ ...prev, phone: "" }));
      } else {
        setErrors((prev) => ({
          ...prev,
          phone: data.error || "인증번호가 일치하지 않습니다.",
        }));
      }
    } catch {
      setErrors((prev) => ({
        ...prev,
        phone: "인증 확인 중 오류가 발생했습니다.",
      }));
    } finally {
      setIsVerifying(false);
    }
  };

  const validateEmail = (emailValue: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, "");
    const limitedNumbers = numbers.slice(0, 11);

    if (limitedNumbers.length <= 3) {
      return limitedNumbers;
    }
    if (limitedNumbers.length <= 7) {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`;
    }
    return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 7)}-${limitedNumbers.slice(7)}`;
  };

  const checkDuplicate = async () => {
    if (!username.trim()) {
      setErrors((prev) => ({ ...prev, username: "아이디를 입력해 주세요." }));
      return;
    }

    try {
      const response = await fetch(getFullUrl("/api/check-username"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (data.available) {
        setDuplicateChecked(true);
        setErrors((prev) => ({ ...prev, username: "" }));
      } else {
        setDuplicateChecked(false);
        setErrors((prev) => ({ ...prev, username: data.message }));
      }
    } catch {
      alert("중복 확인 중 오류가 발생했습니다.");
    }
  };

  const checkEmailDuplicate = async () => {
    if (!email.trim()) {
      setErrors((prev) => ({ ...prev, email: "이메일을 입력해 주세요." }));
      return;
    }

    if (!validateEmail(email)) {
      setErrors((prev) => ({
        ...prev,
        email: "올바른 이메일 형식이 아닙니다.",
      }));
      return;
    }

    try {
      const response = await fetch(getFullUrl("/api/check-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.available) {
        setEmailDuplicateChecked(true);
        setErrors((prev) => ({ ...prev, email: "" }));
      } else {
        setEmailDuplicateChecked(false);
        setErrors((prev) => ({ ...prev, email: data.message }));
      }
    } catch {
      alert("이메일 중복 확인 중 오류가 발생했습니다.");
    }
  };

  const validateForm = () => {
    const newErrors = {
      username: "",
      name: "",
      password: "",
      confirmPassword: "",
      email: "",
      phone: "",
      referralCode: "",
      terms: "",
    };

    if (!username.trim()) {
      newErrors.username = "아이디를 입력해 주세요.";
    } else if (!duplicateChecked) {
      newErrors.username = "아이디 중복 확인을 해주세요.";
    }

    if (!name.trim()) {
      newErrors.name = "이름을 입력해 주세요.";
    }

    if (!password.trim()) {
      newErrors.password = "비밀번호를 입력해 주세요.";
    } else if (password.length < 8) {
      newErrors.password = "비밀번호는 최소 8자 이상이어야 합니다.";
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = "비밀번호를 다시 입력해 주세요.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
    }

    if (!email.trim()) {
      newErrors.email = "이메일을 입력해 주세요.";
    } else if (!validateEmail(email)) {
      newErrors.email = "올바른 이메일 형식이 아닙니다.";
    } else if (!emailDuplicateChecked) {
      newErrors.email = "이메일 중복 확인을 해주세요.";
    }

    if (!phone.trim()) {
      newErrors.phone = "전화번호를 입력해 주세요.";
    } else if (!isPhoneVerified) {
      newErrors.phone = "전화번호 인증을 완료해 주세요.";
    }

    if (!agreeToTerms || !agreeToPrivacy) {
      newErrors.terms = "필수약관 동의가 필요합니다.";
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error !== "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({
      username: true,
      name: true,
      password: true,
      confirmPassword: true,
      email: true,
      phone: true,
      referralCode: true,
    });

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(getFullUrl("/api/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          name,
          password,
          email,
          phone: phone.replace(/-/g, ""),
          referralCode: referralCode || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowSuccessPopup(true);
      } else {
        alert(data.error || "회원가입에 실패했습니다.");
      }
    } catch {
      alert("회원가입 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="user-signup-form" data-testid="signup-page">
        <LandscapeSplitShell
          testId="signup-landscape"
          pageClassName="user-landscape-page--signup"
          left={
            <>
              <div className="user-signup-left-top">
                <div className="user-signup-mascot">
                  <img
                    src={assets.userMascot}
                    alt=""
                    className="user-signup-mascot-img"
                    data-testid="img-signup-mascot"
                  />
                </div>
              </div>

              <div className="user-signup-left-bottom">
                <div
                  className={`user-login-card user-signup-terms-card${
                    errors.terms ? " user-signup-terms-card--error" : ""
                  }`}
                >
                  <div className="user-signup-terms-row">
                    <label htmlFor="terms-service" className="user-signup-terms-label">
                      <input
                        id="terms-service"
                        type="checkbox"
                        data-testid="checkbox-terms-service"
                        checked={agreeToTerms}
                        onChange={(e) => {
                          setAgreeToTerms(e.target.checked);
                          setErrors((prev) => ({ ...prev, terms: "" }));
                        }}
                        className="user-signup-terms-checkbox"
                      />
                      <span>[필수] 서비스 이용약관</span>
                    </label>
                    <button
                      type="button"
                      data-testid="button-terms-service"
                      onClick={() => setPanelModal("service")}
                      className="user-signup-terms-view"
                    >
                      전문보기
                    </button>
                  </div>

                  <div className="user-signup-terms-row">
                    <label htmlFor="terms-privacy" className="user-signup-terms-label">
                      <input
                        id="terms-privacy"
                        type="checkbox"
                        data-testid="checkbox-terms-privacy"
                        checked={agreeToPrivacy}
                        onChange={(e) => {
                          setAgreeToPrivacy(e.target.checked);
                          setErrors((prev) => ({ ...prev, terms: "" }));
                        }}
                        className="user-signup-terms-checkbox"
                      />
                      <span>[필수] 개인정보 처리방침</span>
                    </label>
                    <button
                      type="button"
                      data-testid="button-terms-privacy"
                      onClick={() => setPanelModal("privacy")}
                      className="user-signup-terms-view"
                    >
                      전문보기
                    </button>
                  </div>

                  <div className="user-signup-disclaimer-row">
                    <span className="user-signup-disclaimer-label">15세 이용가 · 재화 안내</span>
                    <button
                      type="button"
                      data-testid="button-disclaimer-view"
                      onClick={() => setPanelModal("disclaimer")}
                      className="user-signup-terms-view"
                    >
                      전문보기
                    </button>
                  </div>
                </div>

                {errors.terms ? (
                  <p className="user-login-error" data-testid="error-terms">
                    {errors.terms}
                  </p>
                ) : null}

                <button
                  type="submit"
                  data-testid="button-signup"
                  disabled={isLoading}
                  className="user-signup-submit"
                >
                  {isLoading ? "가입 중..." : "회원가입"}
                </button>

                <p className="user-signup-back">
                  <Link href="/login" data-testid="link-back-login">
                    로그인으로 돌아가기
                  </Link>
                </p>
              </div>
            </>
          }
          right={
            <div className="user-signup-right-shell">
              <div className="user-signup-panel">
              <div className="user-login-card">
                <div className="user-login-field">
                  <label htmlFor="name" className="user-login-field-label">
                    이름
                  </label>
                  <input
                    id="name"
                    type="text"
                    data-testid="input-name"
                    placeholder="이름 (최대 15자)"
                    value={name}
                    maxLength={15}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (touched.name) {
                        setErrors((prev) => ({ ...prev, name: "" }));
                      }
                    }}
                    className={boxErrorClass(Boolean(errors.name))}
                    autoComplete="name"
                  />
                  {errors.name ? (
                    <p className="user-login-error user-login-error--card" data-testid="error-name">
                      {errors.name}
                    </p>
                  ) : null}
                </div>

                <div className="user-login-field">
                  <label htmlFor="username" className="user-login-field-label">
                    아이디
                  </label>
                  <div className="user-signup-inline-field">
                    <input
                      id="username"
                      type="text"
                      data-testid="input-username"
                      placeholder="아이디"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setDuplicateChecked(false);
                        if (touched.username) {
                          setErrors((prev) => ({ ...prev, username: "" }));
                        }
                      }}
                      className={boxErrorClass(Boolean(errors.username))}
                      autoComplete="username"
                    />
                    <button
                      type="button"
                      onClick={checkDuplicate}
                      data-testid="button-check-duplicate"
                      className="user-signup-inline-btn"
                    >
                      중복 확인
                    </button>
                  </div>
                  {duplicateChecked ? (
                    <p className="user-signup-success">사용 가능한 아이디입니다.</p>
                  ) : errors.username ? (
                    <p className="user-login-error user-login-error--card" data-testid="error-username">
                      {errors.username}
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
                      placeholder="8자리 이상"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (touched.password) {
                          setErrors((prev) => ({ ...prev, password: "" }));
                        }
                      }}
                      className={boxErrorClass(Boolean(errors.password))}
                      style={{ paddingRight: 36 }}
                      autoComplete="new-password"
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

                <div className="user-login-field">
                  <label htmlFor="confirmPassword" className="user-login-field-label">
                    비밀번호 확인
                  </label>
                  <div className="user-login-box-wrap">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      data-testid="input-confirm-password"
                      placeholder="비밀번호 재입력"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (touched.confirmPassword) {
                          setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                        }
                      }}
                      className={boxErrorClass(Boolean(errors.confirmPassword))}
                      style={{ paddingRight: 36 }}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      data-testid="button-toggle-confirm-password"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="user-login-box-toggle"
                      aria-label={showConfirmPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword ? (
                    <p
                      className="user-login-error user-login-error--card"
                      data-testid="error-confirm-password"
                    >
                      {errors.confirmPassword}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="user-login-card">
                <div className="user-login-field">
                  <label htmlFor="phone" className="user-login-field-label">
                    전화번호
                  </label>
                  <div className="user-signup-inline-field">
                    <input
                      id="phone"
                      type="tel"
                      data-testid="input-phone"
                      placeholder="010-0000-0000"
                      value={phone}
                      disabled={isPhoneVerified}
                      onChange={(e) => {
                        if (isPhoneVerified) return;
                        const formatted = formatPhoneNumber(e.target.value);
                        if (formatted === phone) return;
                        setPhone(formatted);
                        setIsPhoneVerified(false);
                        setShowVerificationInput(false);
                        setVerificationTimer(0);
                        if (touched.phone) {
                          setErrors((prev) => ({ ...prev, phone: "" }));
                        }
                      }}
                      className={boxErrorClass(Boolean(errors.phone && !isPhoneVerified))}
                      autoComplete="tel"
                    />
                    <button
                      type="button"
                      onClick={sendVerificationCode}
                      disabled={isSendingCode || isPhoneVerified}
                      data-testid="button-send-verification"
                      className="user-signup-inline-btn"
                    >
                      {isSendingCode ? "전송 중..." : showVerificationInput ? "재요청" : "인증요청"}
                    </button>
                  </div>

                  {showVerificationInput ? (
                    <div className="user-signup-verify-row">
                      <div className="user-login-box-wrap">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          data-testid="input-verification-code"
                          placeholder="인증번호 6자리"
                          value={verificationCode}
                          disabled={isPhoneVerified}
                          onChange={(e) => {
                            setVerificationCode(e.target.value.replace(/[^0-9]/g, ""));
                          }}
                          className={boxErrorClass(false)}
                        />
                        {verificationTimer > 0 && !isPhoneVerified ? (
                          <span className="user-signup-verify-timer" data-testid="text-verification-timer">
                            {formatTimer(verificationTimer)}
                          </span>
                        ) : null}
                      </div>
                      {!isPhoneVerified ? (
                        <button
                          type="button"
                          onClick={verifyCode}
                          disabled={isVerifying || verificationTimer === 0}
                          data-testid="button-verify-code"
                          className="user-signup-inline-btn"
                        >
                          {isVerifying ? "확인 중..." : "인증하기"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {isPhoneVerified ? (
                    <p className="user-signup-success" data-testid="text-verification-success">
                      인증되었습니다.
                    </p>
                  ) : errors.phone ? (
                    <p className="user-login-error user-login-error--card" data-testid="error-phone">
                      {errors.phone}
                    </p>
                  ) : showVerificationInput && verificationTimer === 0 ? (
                    <p className="user-login-error user-login-error--card">
                      인증시간이 만료되었습니다. 재요청 버튼을 눌러주세요.
                    </p>
                  ) : null}
                </div>

                <div className="user-login-field">
                  <label htmlFor="email" className="user-login-field-label">
                    이메일
                  </label>
                  <div className="user-signup-inline-field">
                    <input
                      id="email"
                      type="email"
                      data-testid="input-email"
                      placeholder="이메일"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailDuplicateChecked(false);
                        if (touched.email) {
                          setErrors((prev) => ({ ...prev, email: "" }));
                        }
                      }}
                      className={boxErrorClass(Boolean(errors.email))}
                      autoComplete="email"
                    />
                    <button
                      type="button"
                      onClick={checkEmailDuplicate}
                      data-testid="button-check-email-duplicate"
                      className="user-signup-inline-btn"
                    >
                      중복 확인
                    </button>
                  </div>
                  {emailDuplicateChecked ? (
                    <p className="user-signup-success">사용 가능한 이메일입니다.</p>
                  ) : errors.email ? (
                    <p className="user-login-error user-login-error--card" data-testid="error-email">
                      {errors.email}
                    </p>
                  ) : null}
                </div>

                <div className="user-login-field">
                  <label htmlFor="referralCode" className="user-login-field-label">
                    추천인
                  </label>
                  <input
                    id="referralCode"
                    type="text"
                    data-testid="input-referral-code"
                    placeholder="추천인 코드 (선택)"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    className={boxErrorClass(Boolean(errors.referralCode))}
                  />
                </div>
              </div>
              </div>

              <SignupPanelModal
                open={panelModal !== null}
                title={
                  panelModal === "service"
                    ? serviceTerm?.title || "서비스 이용약관"
                    : panelModal === "privacy"
                      ? privacyTerm?.title || "개인정보 처리방침"
                      : "이용 안내"
                }
                onClose={() => setPanelModal(null)}
                testId={
                  panelModal === "service"
                    ? "terms-modal"
                    : panelModal === "privacy"
                      ? "terms-modal"
                      : "disclaimer-modal"
                }
              >
                {panelModal === "disclaimer" ? (
                  <img
                    src={splashDisclaimer}
                    alt="15세 이용가 및 재화 안내"
                    className="user-signup-panel-modal-image"
                    data-testid="disclaimer-modal-image"
                  />
                ) : panelModal === "service" ? (
                  serviceTerm?.content ? (
                    <p className="user-signup-panel-modal-text" data-testid="terms-content">
                      {serviceTerm.content}
                    </p>
                  ) : (
                    <p className="user-signup-panel-modal-empty">약관 내용을 불러올 수 없습니다.</p>
                  )
                ) : panelModal === "privacy" ? (
                  privacyTerm?.content ? (
                    <p className="user-signup-panel-modal-text" data-testid="terms-content">
                      {privacyTerm.content}
                    </p>
                  ) : (
                    <p className="user-signup-panel-modal-empty">약관 내용을 불러올 수 없습니다.</p>
                  )
                ) : null}
              </SignupPanelModal>
            </div>
          }
        />
      </form>

      {showSuccessPopup ? (
        <Popup
          message="회원가입이 완료되었습니다."
          buttonText="확인"
          onConfirm={() => {
            stashSignupLoginPrefill(username, password);
            setLocation("/login?guest=0");
          }}
        />
      ) : null}
    </>
  );
}
