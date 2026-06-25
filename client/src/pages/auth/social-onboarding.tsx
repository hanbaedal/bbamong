import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useUser } from "@/contexts/UserContext";
import Popup from "@/components/customUi/infoPopup";
import { TermsModal } from "@/components/TermsModal";
import { Term } from "@shared/schema";
import { getFullUrl } from "@/lib/queryClient";
import { completeLoginNavigation } from "@/lib/appNavigation";
import { setAccessToken, saveRefreshToken } from "@/lib/tokenManager";
import { resetRefreshCooldown } from "@/lib/queryClient";
import PageHeader from "@/components/PageHeader";

export default function SocialOnboardingPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const pendingCode = new URLSearchParams(search).get("code");
  const { assets } = useUserAssets();
  const { setUser } = useUser();

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
  const [termsModalType, setTermsModalType] = useState<"service" | "privacy" | null>(null);

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

  useEffect(() => {
    if (!pendingCode) {
      setLocation("/login", { replace: true });
      return;
    }
    const fetchSocialData = async () => {
      try {
        const res = await fetch(getFullUrl(`/api/users/social-pending/${pendingCode}`));
        if (res.ok) {
          const data = await res.json();
          if (data.name) setName(data.name);
          if (data.email) setEmail(data.email);
          if (data.phone) setPhone(data.phone);
        }
      } catch (error) {
        console.error("소셜 데이터 로드 실패:", error);
      }
    };
    fetchSocialData();
  }, [pendingCode, setLocation]);

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
    fetchTerms();
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
      setErrors((prev) => ({ ...prev, phone: "올바른 전화번호 형식이 아닙니다." }));
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
        setErrors((prev) => ({ ...prev, phone: data.error || "인증번호 전송에 실패했습니다." }));
      }
    } catch (error) {
      setErrors((prev) => ({ ...prev, phone: "인증번호 전송 중 오류가 발생했습니다." }));
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
        setErrors((prev) => ({ ...prev, phone: data.error || "인증번호가 일치하지 않습니다." }));
      }
    } catch (error) {
      setErrors((prev) => ({ ...prev, phone: "인증 확인 중 오류가 발생했습니다." }));
    } finally {
      setIsVerifying(false);
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, "");
    const limitedNumbers = numbers.slice(0, 11);
    if (limitedNumbers.length <= 3) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 7) {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`;
    } else {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 7)}-${limitedNumbers.slice(7)}`;
    }
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
        setErrors((prev) => ({ ...prev, username: data.message }));
      }
    } catch (error) {
      alert("중복 확인 중 오류가 발생했습니다.");
    }
  };

  const checkEmailDuplicate = async () => {
    if (!email.trim()) {
      setErrors((prev) => ({ ...prev, email: "이메일을 입력해 주세요." }));
      return;
    }

    if (!validateEmail(email)) {
      setErrors((prev) => ({ ...prev, email: "올바른 이메일 형식이 아닙니다." }));
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
        setErrors((prev) => ({ ...prev, email: data.message }));
      }
    } catch (error) {
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

    if (!username.trim()) newErrors.username = "아이디를 입력해 주세요.";
    if (!duplicateChecked) newErrors.username = newErrors.username || "아이디 중복 확인을 해주세요.";

    if (!name.trim()) newErrors.name = "이름을 입력해 주세요.";

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

  const handleBack = () => {
    setLocation("/login");
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

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await fetch(getFullUrl("/api/users/social-onboarding"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pendingCode,
          username,
          name,
          password,
          confirmPassword,
          email,
          phone: phone.replace(/-/g, ""),
          referralCode: referralCode || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.accessToken && data.refreshToken) {
          resetRefreshCooldown();
          setAccessToken(data.accessToken);
          await saveRefreshToken(data.refreshToken);
        }
        if (data.user) {
          setUser(data.user);
        }
        setShowSuccessPopup(true);
      } else {
        alert(data.error || "회원가입에 실패했습니다.");
      }
    } catch (error) {
      alert("회원가입 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-app-screen bg-[#111111]">
      <PageHeader
        showSettings={false}
        leftAction={
          <button
            onClick={handleBack}
            data-testid="button-back"
            className="p-1"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
      />

      <div className="flex-1 flex flex-col px-5 py-8 overflow-y-scroll-touch" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }}>
        <div className="w-full">
          <h1 className="text-white text-2xl font-semibold mb-8" data-testid="text-title">
            추가 정보를 입력해 주세요
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 아이디 */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[#D5D5D5] text-sm">
                아이디
              </Label>
              <div
                className={`flex items-center gap-2 border-0 border-b ${
                  errors.username
                    ? "border-b-red-500 focus-within:border-b-red-500"
                    : "border-b-[#373539] focus-within:border-b-[#E9E9E9]"
                }`}
              >
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconUsername} alt="" className="w-5 h-5 object-contain" data-testid="icon-username" />
                </div>
                <Input
                  id="username"
                  type="text"
                  data-testid="input-username"
                  placeholder="아이디를 입력해 주세요"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setDuplicateChecked(false);
                    if (touched.username) setErrors((prev) => ({ ...prev, username: "" }));
                  }}
                  className="h-12 flex-1 min-w-0 bg-transparent border-0 text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none px-0"
                />
                <Button
                  type="button"
                  onClick={checkDuplicate}
                  data-testid="button-check-duplicate"
                  className="flex-shrink-0 h-auto p-[10px] py-[5px] bg-[#201E22] text-white hover:bg-[#4A4A4A] whitespace-nowrap rounded-sm text-sm border-none"
                >
                  중복 확인
                </Button>
              </div>
              {duplicateChecked ? (
                <p className="text-[#CCF501] text-xs">사용 가능한 아이디 입니다.</p>
              ) : errors.username ? (
                <p className="text-red-500 text-xs" data-testid="error-username">{errors.username}</p>
              ) : null}
            </div>

            {/* 이름 */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#D5D5D5] text-sm">
                이름
              </Label>
              <div
                className={`flex items-center gap-2 border-0 border-b ${
                  errors.name
                    ? "border-b-red-500 focus-within:border-b-red-500"
                    : "border-b-[#373539] focus-within:border-b-[#E9E9E9]"
                }`}
              >
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconName} alt="" className="w-5 h-5 object-contain" data-testid="icon-name" />
                </div>
                <Input
                  id="name"
                  type="text"
                  data-testid="input-name"
                  placeholder="이름을 입력해 주세요 (최대 15자)"
                  value={name}
                  maxLength={15}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (touched.name) setErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  className="h-12 flex-1 min-w-0 bg-transparent border-0 text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none px-0"
                />
              </div>
              {errors.name && (
                <p className="text-red-500 text-xs" data-testid="error-name">{errors.name}</p>
              )}
            </div>

            {/* 비밀번호 */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#D5D5D5] text-sm">
                보안용 비밀번호 설정
              </Label>
              <div
                className={`flex items-center gap-2 border-0 border-b ${
                  errors.password
                    ? "border-b-red-500 focus-within:border-b-red-500"
                    : "border-b-[#373539] focus-within:border-b-[#E9E9E9]"
                }`}
              >
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconPassword} alt="" className="w-5 h-5 object-contain" data-testid="icon-password" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  data-testid="input-password"
                  placeholder="8자리 이상"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (touched.password) setErrors((prev) => ({ ...prev, password: "" }));
                  }}
                  className="h-12 flex-1 min-w-0 bg-transparent border-0 text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none px-0"
                />
                <button
                  type="button"
                  data-testid="button-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex-shrink-0 text-[#6B6B6B] hover:text-[#D5D5D5] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs" data-testid="error-password">{errors.password}</p>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#D5D5D5] text-sm">
                보안용 비밀번호 확인
              </Label>
              <div
                className={`flex items-center gap-2 border-0 border-b ${
                  errors.confirmPassword
                    ? "border-b-red-500 focus-within:border-b-red-500"
                    : "border-b-[#373539] focus-within:border-b-[#E9E9E9]"
                }`}
              >
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconPassword} alt="" className="w-5 h-5 object-contain" data-testid="icon-confirm-password" />
                </div>
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  data-testid="input-confirm-password"
                  placeholder="비밀번호를 한번더 입력해 주세요"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (touched.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                  }}
                  className="h-12 flex-1 min-w-0 bg-transparent border-0 text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none px-0"
                />
                <button
                  type="button"
                  data-testid="button-toggle-confirm-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="flex-shrink-0 text-[#6B6B6B] hover:text-[#D5D5D5] transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs" data-testid="error-confirm-password">{errors.confirmPassword}</p>
              )}
            </div>

            {/* 이메일 */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#D5D5D5] text-sm">
                이메일
              </Label>
              <div
                className={`flex items-center gap-2 border-0 border-b ${
                  errors.email
                    ? "border-b-red-500 focus-within:border-b-red-500"
                    : "border-b-[#373539] focus-within:border-b-[#E9E9E9]"
                }`}
              >
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconEmail} alt="" className="w-5 h-5 object-contain" data-testid="icon-email" />
                </div>
                <Input
                  id="email"
                  type="email"
                  data-testid="input-email"
                  placeholder="이메일을 입력해 주세요"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailDuplicateChecked(false);
                    if (touched.email) setErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  className="h-12 flex-1 min-w-0 bg-transparent border-0 text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none px-0"
                />
                <Button
                  type="button"
                  onClick={checkEmailDuplicate}
                  data-testid="button-check-email-duplicate"
                  className="flex-shrink-0 h-auto p-[10px] py-[5px] bg-[#201E22] text-white hover:bg-[#4A4A4A] whitespace-nowrap rounded-sm text-sm border-none"
                >
                  중복 확인
                </Button>
              </div>
              {emailDuplicateChecked ? (
                <p className="text-[#CCF501] text-xs">사용 가능한 이메일 입니다.</p>
              ) : errors.email ? (
                <p className="text-red-500 text-xs" data-testid="error-email">{errors.email}</p>
              ) : null}
            </div>

            {/* 전화번호 */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[#D5D5D5] text-sm">
                전화번호
              </Label>
              <div
                className={`flex items-center gap-2 border-0 border-b ${
                  errors.phone
                    ? "border-b-red-500 focus-within:border-b-red-500"
                    : "border-b-[#373539] focus-within:border-b-[#E9E9E9]"
                }`}
              >
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconPhone} alt="" className="w-5 h-5 object-contain" data-testid="icon-phone" />
                </div>
                <Input
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
                    if (touched.phone) setErrors((prev) => ({ ...prev, phone: "" }));
                  }}
                  className="h-12 flex-1 min-w-0 bg-transparent border-0 text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none px-0"
                />
                <Button
                  type="button"
                  onClick={sendVerificationCode}
                  disabled={isSendingCode || isPhoneVerified}
                  data-testid="button-send-verification"
                  className="flex-shrink-0 h-auto p-[10px] py-[5px] bg-[#201E22] text-white hover:bg-[#4A4A4A] whitespace-nowrap rounded-sm text-sm border-none disabled:opacity-50"
                >
                  {isSendingCode ? "전송 중..." : showVerificationInput ? "재요청" : "인증요청"}
                </Button>
              </div>

              {errors.phone && !isPhoneVerified && (
                <p className="text-red-500 text-xs" data-testid="error-phone">{errors.phone}</p>
              )}

              {showVerificationInput && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        data-testid="input-verification-code"
                        placeholder="인증번호 6자리"
                        value={verificationCode}
                        disabled={isPhoneVerified}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, "");
                          setVerificationCode(value);
                        }}
                        className={`h-12 bg-transparent border-0 border-b text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none px-4 pr-16 ${
                          isPhoneVerified
                            ? "border-b-[#373539]"
                            : "border-b-[#373539] focus-visible:border-b-[#E9E9E9]"
                        }`}
                      />
                      {verificationTimer > 0 && !isPhoneVerified && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#E11936] text-sm font-medium" data-testid="text-verification-timer">
                          {formatTimer(verificationTimer)}
                        </span>
                      )}
                    </div>
                    {!isPhoneVerified && (
                      <Button
                        type="button"
                        onClick={verifyCode}
                        disabled={isVerifying || verificationTimer === 0}
                        data-testid="button-verify-code"
                        className="h-auto p-[10px] py-[5px] bg-[#201E22] text-white hover:bg-[#4A4A4A] rounded-sm text-sm border-none disabled:opacity-50"
                      >
                        {isVerifying ? "확인 중..." : "인증하기"}
                      </Button>
                    )}
                  </div>
                  {isPhoneVerified ? (
                    <p className="text-yellow-500 text-xs" data-testid="text-verification-success">인증되었습니다.</p>
                  ) : verificationTimer === 0 ? (
                    <p className="text-[#FF6B6B] text-xs">인증시간이 만료되었습니다. 재요청 버튼을 눌러주세요.</p>
                  ) : null}
                </div>
              )}
            </div>

            {/* 추천인 코드 */}
            <div className="space-y-2">
              <Label htmlFor="referralCode" className="text-[#D5D5D5] text-sm">
                추천인 코드
              </Label>
              <div className="flex items-center gap-2 border-0 border-b border-b-[#373539] focus-within:border-b-[#E9E9E9]">
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <img src={assets.iconReferral} alt="" className="w-5 h-5 object-contain" data-testid="icon-referral" />
                </div>
                <Input
                  id="referralCode"
                  type="text"
                  data-testid="input-referral-code"
                  placeholder="추천인 코드를 입력해 주세요"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  className="h-12 flex-1 min-w-0 bg-transparent border-0 text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none px-0"
                />
              </div>
            </div>

            {/* 약관 동의 */}
            <div className="space-y-2 pt-4">
              <div className={`bg-[#1C1F20] rounded-[6px] p-5 flex flex-col gap-5 border ${errors.terms ? "border-[#E75C5D]" : "border-transparent"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="terms-service"
                      data-testid="checkbox-terms-service"
                      checked={agreeToTerms}
                      onCheckedChange={(checked) => {
                        setAgreeToTerms(checked as boolean);
                        setErrors({ ...errors, terms: "" });
                      }}
                      className="w-[18px] h-[18px] border-[#373539] data-[state=checked]:bg-[#CCF501] data-[state=checked]:text-[#111111] data-[state=checked]:border-[#CCF501]"
                    />
                    <label htmlFor="terms-service" className="text-base text-[#959595] cursor-pointer">
                      [필수] 서비스 이용약관 동의
                    </label>
                  </div>
                  <button
                    type="button"
                    data-testid="button-terms-service"
                    onClick={() => setTermsModalType("service")}
                    className="text-sm text-[#717680] hover:text-[#CCF501] transition-colors"
                  >
                    전문보기
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="terms-privacy"
                      data-testid="checkbox-terms-privacy"
                      checked={agreeToPrivacy}
                      onCheckedChange={(checked) => {
                        setAgreeToPrivacy(checked as boolean);
                        setErrors({ ...errors, terms: "" });
                      }}
                      className="w-[18px] h-[18px] border-[#373539] data-[state=checked]:bg-[#CCF501] data-[state=checked]:text-[#111111] data-[state=checked]:border-[#CCF501]"
                    />
                    <label htmlFor="terms-privacy" className="text-base text-[#959595] cursor-pointer">
                      [필수] 개인정보 처리방침 동의
                    </label>
                  </div>
                  <button
                    type="button"
                    data-testid="button-terms-privacy"
                    onClick={() => setTermsModalType("privacy")}
                    className="text-sm text-[#717680] hover:text-[#CCF501] transition-colors"
                  >
                    전문보기
                  </button>
                </div>
              </div>

              {errors.terms && (
                <p className="text-red-500 text-xs" data-testid="error-terms">{errors.terms}</p>
              )}
            </div>

            {/* 시작하기 버튼 */}
            <Button
              type="submit"
              data-testid="button-submit"
              disabled={isLoading}
              className="w-full h-12 bg-[#CDFF00] active:bg-[#C8D48D] border border-[#CDFF00] text-black font-semibold text-base rounded-lg mt-8"
            >
              {isLoading ? "저장 중..." : "시작하기"}
            </Button>
          </form>
        </div>
      </div>

      {showSuccessPopup && (
        <Popup
          message="회원가입이 완료되었습니다."
          buttonText="확인"
          onConfirm={() => void completeLoginNavigation(setLocation, "/home")}
        />
      )}

      {termsModalType && (
        <TermsModal
          open={!!termsModalType}
          onOpenChange={(open) => !open && setTermsModalType(null)}
          term={termsModalType === "service" ? serviceTerm : privacyTerm}
        />
      )}
    </div>
  );
}
