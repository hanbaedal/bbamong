import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { getFullUrl } from "@/lib/adminQueryClient";
import { AdminTermsModal } from "@/components/AdminTermsModal";
import { Term } from "@shared/schema";

export default function AdminSignupPage() {
  const [, setLocation] = useLocation();
  const { assets } = useAdminAssets();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // 전화번호 인증 관련 상태
  const [showVerificationInput, setShowVerificationInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationTimer, setVerificationTimer] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  // 약관 관련 상태
  const [operatorTerm, setOperatorTerm] = useState<Term | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsLoadError, setTermsLoadError] = useState(false);
  
  const [errors, setErrors] = useState({
    email: "",
    name: "",
    password: "",
    confirmPassword: "",
    phone: "",
    terms: "",
  });

  // 페이지 진입 시 운영자 약관 로드
  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const response = await fetch(getFullUrl("/api/terms/type/operator"));
        if (response.ok) {
          const data = await response.json();
          if (data && data.id && data.content && data.content.trim()) {
            setOperatorTerm(data);
            setTermsLoadError(false);
          } else {
            setOperatorTerm(null);
            setTermsLoadError(true);
            setAgreeToTerms(false);
            setErrors((prev) => ({ ...prev, terms: "약관을 불러올 수 없습니다. 잠시 후 다시 시도해주세요." }));
          }
        } else {
          setOperatorTerm(null);
          setTermsLoadError(true);
          setAgreeToTerms(false);
          setErrors((prev) => ({ ...prev, terms: "약관을 불러올 수 없습니다. 잠시 후 다시 시도해주세요." }));
        }
      } catch (error) {
        console.error("약관 로드 실패:", error);
        setOperatorTerm(null);
        setTermsLoadError(true);
        setAgreeToTerms(false);
        setErrors((prev) => ({ ...prev, terms: "약관을 불러올 수 없습니다. 잠시 후 다시 시도해주세요." }));
      }
    };

    fetchTerms();
  }, []);

  // 약관 상태가 유효하지 않으면 동의 체크 해제 및 에러 메시지 표시
  useEffect(() => {
    if (termsLoadError || !operatorTerm?.content?.trim()) {
      setAgreeToTerms(false);
      if (termsLoadError) {
        setErrors((prev) => ({ ...prev, terms: "약관을 불러올 수 없습니다. 잠시 후 다시 시도해주세요." }));
      }
    }
  }, [termsLoadError, operatorTerm]);

  // 인증 타이머 효과
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

  // 타이머 포맷팅 (MM:SS)
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 인증번호 전송
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
      // 전화번호 중복 확인
      const checkResponse = await fetch(getFullUrl("/api/admin/check-phone"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      
      if (!checkResponse.ok) {
        const errorData = await checkResponse.json();
        setErrors((prev) => ({ ...prev, phone: errorData.error || "전화번호 확인 중 오류가 발생했습니다." }));
        setIsSendingCode(false);
        return;
      }
      
      const checkData = await checkResponse.json();
      
      if (checkData.exists) {
        setErrors((prev) => ({ ...prev, phone: "이미 등록된 전화번호입니다." }));
        setIsSendingCode(false);
        return;
      }
      
      // 인증번호 전송
      const response = await fetch(getFullUrl("/api/phone/send-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, type: "admin" }),
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

  // 인증번호 확인
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
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '');
    
    // 11자리까지만 허용
    const limitedNumbers = numbers.slice(0, 11);
    
    // 하이픈 추가 (010-1234-5678 형식)
    if (limitedNumbers.length <= 3) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 7) {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`;
    } else {
      return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 7)}-${limitedNumbers.slice(7)}`;
    }
  };

  const validateForm = () => {
    const newErrors = {
      email: "",
      name: "",
      password: "",
      confirmPassword: "",
      phone: "",
      terms: "",
    };

    if (!email.trim()) {
      newErrors.email = "이메일을 입력해 주세요.";
    } else if (!validateEmail(email)) {
      newErrors.email = "올바른 이메일 형식이 아닙니다.";
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

    if (!phone.trim()) {
      newErrors.phone = "전화번호를 입력해 주세요.";
    } else if (!isPhoneVerified) {
      newErrors.phone = "전화번호 인증을 완료해 주세요.";
    }

    if (termsLoadError || !operatorTerm?.content?.trim()) {
      newErrors.terms = "약관을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.";
    } else if (!agreeToTerms) {
      newErrors.terms = "직원의 책임과 의무에 동의해 주세요.";
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error !== "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(getFullUrl("/api/admin/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username: email,
          name,
          password,
          phone: phone.replace(/-/g, ""),
          userType: isAdmin ? "최고어드민" : "일반어드민",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setLocation("/admin/waiting");
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
    <div className="min-h-screen h-screen overflow-y-auto bg-white flex flex-col items-center px-5 py-8 admin-autofill-dark">
      <div className="w-full max-w-[736px] flex flex-col gap-[60px] my-auto">
        {/* 로고 */}
        <div
          className="w-[149px] h-[110px] flex items-center justify-center mx-auto"
          data-testid="admin-signup-logo-container"
        >
          <img
            src={assets.loginLogo}
            alt="관리자 로고"
            className="w-full h-full object-contain"
            data-testid="img-admin-signup-logo"
          />
        </div>

        {/* 제목 + 폼 */}
        <div className="flex flex-col gap-[30px]">
          {/* 제목 */}
          <h1 className="text-[#201E22] text-[22px] font-semibold leading-[140%] tracking-[-0.025em]">
            직원으로 회원가입
          </h1>

          {/* 폼 */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-[50px]">
            {/* Row 1: 이메일 + 이름 */}
            <div className="flex gap-[50px]">
              {/* 이메일 */}
              <div className="flex-1 flex flex-col gap-[10px]">
                <Label
                  htmlFor="email"
                  className="text-[#4D4B4E] text-[14px] font-medium leading-[140%] tracking-[-0.025em]"
                >
                  이메일
                </Label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                    <img
                      src={assets.adEmailIcon}
                      alt=""
                      className="w-5 h-5 object-contain ml-2"
                      data-testid="icon-password"
                    />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    data-testid="input-admin-signup-email"
                    placeholder="이메일을 입력해 주세요"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({ ...prev, email: "" }));
                    }}
                    className="h-12 bg-transparent border-0 border-b text-[#201E22] text-base placeholder:text-[#BFBFBF] rounded-none pl-8 pr-12 focus:outline-none focus:ring-0 focus-visible:ring-0 border-b-[#373539] focus-visible:border-b-[#373539]"
                  />
                  
                </div>
                <div className="min-h-[16px]">
                  {errors.email && (
                    <p
                      className="text-red-500 text-xs"
                      data-testid="error-admin-signup-email"
                    >
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>
              {/* 이름 */}
              <div className="flex-1 flex flex-col gap-[10px]">
                <Label
                  htmlFor="name"
                  className="text-[#4D4B4E] text-[14px] font-medium leading-[140%]"
                >
                  이름
                </Label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                    <img
                      src={assets.adNameIcon} // 아이콘 없으면 대체
                      alt=""
                      className="w-5 h-5 object-contain ml-2"
                      data-testid="icon-name"
                    />
                  </div>
                  <Input
                    id="name"
                    type="text"
                    data-testid="input-admin-signup-name"
                    placeholder="이름을 입력해 주세요"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    className="h-12 bg-transparent border-0 border-b text-[#201E22] text-base placeholder:text-[#BFBFBF] rounded-none pl-8 pr-2 focus:outline-none focus:ring-0 focus-visible:ring-0 border-b-[#373539] focus-visible:border-b-[#000]"
                  />
                </div>
                <div className="min-h-[16px]">
                  {errors.name && (
                    <p className="text-red-500 text-xs">{errors.name}</p>
                  )}
                </div>
              </div>{" "}
            </div>

            {/* Row 2: 비밀번호 + 비밀번호 확인 */}
            <div className="flex gap-[50px]">
              {/* 비밀번호 */}
              <div className="flex-1 flex flex-col gap-[10px]">
                <Label
                  htmlFor="password"
                  className="text-[#4D4B4E] text-[14px] font-medium leading-[140%]"
                >
                  비밀번호
                </Label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                    <img
                      src={assets.adPasswordIcon}
                      alt=""
                      className="w-5 h-5 object-contain ml-2"
                      data-testid="icon-password"
                    />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    data-testid="input-admin-signup-password"
                    placeholder="비밀번호를 입력해 주세요"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((prev) => ({ ...prev, password: "" }));
                    }}
                    className="h-12 bg-transparent border-0 border-b text-[#201E22] text-base placeholder:text-[#BFBFBF] rounded-none pl-8 pr-10 focus:outline-none focus:ring-0 focus-visible:ring-0 border-b-[#373539] focus-visible:border-b-[#000]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#414141] hover:text-[#201E22]"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="min-h-[16px]">
                  {errors.password && (
                    <p className="text-red-500 text-xs">{errors.password}</p>
                  )}
                </div>
              </div>

              {/* 비밀번호 확인 */}
              <div className="flex-1 flex flex-col gap-[10px]">
                <Label
                  htmlFor="confirmPassword"
                  className="text-[#4D4B4E] text-[14px] font-medium leading-[140%]"
                >
                  비밀번호 확인
                </Label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                    <img
                      src={assets.adPasswordIcon}
                      alt=""
                      className="w-5 h-5 object-contain ml-2"
                      data-testid="icon-confirm-password"
                    />
                  </div>
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    data-testid="input-admin-signup-confirm-password"
                    placeholder="비밀번호를 다시 입력해 주세요"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                    }}
                    className="h-12 bg-transparent border-0 border-b text-[#201E22] text-base placeholder:text-[#BFBFBF] rounded-none pl-8 pr-10 focus:outline-none focus:ring-0 focus-visible:ring-0 border-b-[#373539] focus-visible:border-b-[#000]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#414141] hover:text-[#201E22]"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="min-h-[16px]">
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-xs">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {/* Row 3: 전화번호 */}
            <div className="flex gap-[50px]">
              <div className="flex-1 flex flex-col gap-[10px]">
                <Label
                  htmlFor="phone"
                  className="text-[#4D4B4E] text-[14px] font-medium leading-[140%] tracking-[-0.025em]"
                >
                  전화번호
                </Label>
                <div className="flex gap-[10px] items-end">
                  <div className="relative flex-1 flex items-center">
                    <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                      <img
                        src={assets.adNameIcon}
                        alt=""
                        className="w-5 h-5 object-contain ml-2"
                        data-testid="icon-phone"
                      />
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      data-testid="input-admin-signup-phone"
                      placeholder="010-0000-0000"
                      value={phone}
                      disabled={isPhoneVerified}
                      onChange={(e) => {
                        setPhone(formatPhoneNumber(e.target.value));
                        setErrors((prev) => ({ ...prev, phone: "" }));
                      }}
                      className="h-12 bg-transparent border-0 border-b text-[#201E22] text-base placeholder:text-[#BFBFBF] rounded-none pl-8 pr-2 focus:outline-none focus:ring-0 focus-visible:ring-0 border-b-[#373539] focus-visible:border-b-[#000] disabled:opacity-60"
                    />
                  </div>
                  <Button
                    type="button"
                    data-testid="button-send-verification"
                    onClick={sendVerificationCode}
                    disabled={isSendingCode || isPhoneVerified}
                    className="h-12 px-4 bg-[#E11936] hover:bg-[#C41530] text-white text-sm font-medium rounded-lg whitespace-nowrap"
                  >
                    {isSendingCode ? "전송 중..." : isPhoneVerified ? "인증완료" : verificationTimer > 0 ? "재전송" : "인증번호 전송"}
                  </Button>
                </div>

                {showVerificationInput && !isPhoneVerified && (
                  <div className="flex gap-[10px] items-end mt-1">
                    <div className="relative flex-1">
                      <Input
                        type="text"
                        data-testid="input-verification-code"
                        placeholder="인증번호 입력"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="h-12 bg-transparent border-0 border-b text-[#201E22] text-base placeholder:text-[#BFBFBF] rounded-none pl-2 pr-16 focus:outline-none focus:ring-0 focus-visible:ring-0 border-b-[#373539] focus-visible:border-b-[#000]"
                      />
                      {verificationTimer > 0 && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#E11936] text-sm font-medium">
                          {formatTimer(verificationTimer)}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      data-testid="button-verify-code"
                      onClick={verifyCode}
                      disabled={isVerifying || verificationTimer === 0}
                      className="h-12 px-4 bg-[#373539] hover:bg-[#201E22] text-white text-sm font-medium rounded-lg whitespace-nowrap"
                    >
                      {isVerifying ? "확인 중..." : "확인"}
                    </Button>
                  </div>
                )}

                {isPhoneVerified && (
                  <p className="text-green-600 text-xs" data-testid="text-phone-verified">
                    전화번호 인증이 완료되었습니다.
                  </p>
                )}

                <div className="min-h-[16px]">
                  {errors.phone && (
                    <p
                      className="text-red-500 text-xs"
                      data-testid="error-admin-phone"
                    >
                      {errors.phone}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex-1" />
            </div>

            {/* 운영자 약관 동의 */}
            <div className={`bg-[#F5F5F5] rounded-md px-4 py-3 flex flex-col gap-3 border ${errors.terms || termsLoadError ? "border-red-500" : "border-[#E0E0E0]"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="terms-operator"
                    data-testid="checkbox-terms-operator"
                    checked={agreeToTerms}
                    disabled={termsLoadError || !operatorTerm?.content?.trim()}
                    onCheckedChange={(checked) => {
                      if (termsLoadError || !operatorTerm?.content?.trim()) return;
                      setAgreeToTerms(checked as boolean);
                      setErrors((prev) => ({ ...prev, terms: "" }));
                    }}
                    className="w-[18px] h-[18px] border-[#373539] data-[state=checked]:bg-[#FFC107] data-[state=checked]:text-black data-[state=checked]:border-[#FFC107] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <label
                    htmlFor="terms-operator"
                    className={`text-[14px] cursor-pointer ${termsLoadError || !operatorTerm?.content?.trim() ? "text-[#999999]" : "text-[#4D4B4E]"}`}
                  >
                    [필수] 직원의 책임과 의무
                  </label>
                </div>
                <button
                  type="button"
                  data-testid="button-terms-operator"
                  onClick={() => {
                    if (termsLoadError || !operatorTerm?.content?.trim()) return;
                    setShowTermsModal(true);
                  }}
                  disabled={termsLoadError || !operatorTerm?.content?.trim()}
                  className={`text-sm transition-colors ${termsLoadError || !operatorTerm?.content?.trim() ? "text-[#999999] cursor-not-allowed" : "text-[#717680] hover:text-[#E11936]"}`}
                >
                  전문보기
                </button>
              </div>

              {termsLoadError && (
                <p className="text-red-500 text-xs" data-testid="error-terms-load">
                  약관을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.
                </p>
              )}
              {errors.terms && !termsLoadError && (
                <p className="text-red-500 text-xs" data-testid="error-terms">
                  {errors.terms}
                </p>
              )}
            </div>
          </form>
        </div>

        {/* 회원가입 버튼 */}
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={isLoading}
          data-testid="button-admin-signup"
          className="w-full h-[52px] bg-[#E11936] hover:bg-[#C41530] text-white text-base font-semibold rounded-lg"
        >
          {isLoading ? "등록 중..." : "등록"}
        </Button>
      </div>

      {/* 운영자 약관 전문보기 모달 */}
      <AdminTermsModal
        open={showTermsModal}
        onOpenChange={setShowTermsModal}
        term={operatorTerm}
      />
    </div>
  );
}
