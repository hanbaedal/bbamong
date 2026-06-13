import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import { useUserAssets } from "@/contexts/UserAssetContext";
import InfoPopup from "@/components/customUi/infoPopup";
import { getFullUrl } from "@/lib/queryClient";

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { assets } = useUserAssets();
  const [step, setStep] = useState<"phone" | "reset">("phone");
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({
    phone: "",
    code: "",
    password: "",
    confirmPassword: "",
  });

  const [showCodeSentPopup, setShowCodeSentPopup] = useState(false);
  const [showResetSuccessPopup, setShowResetSuccessPopup] = useState(false);

  const validatePhone = (phone: string) => {
    const cleanPhone = phone.replace(/-/g, "");
    return /^01[0-9]{8,9}$/.test(cleanPhone);
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
    setErrors((prev) => ({ ...prev, phone: "" }));
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim()) {
      setErrors((prev) => ({ ...prev, phone: "전화번호를 입력해 주세요." }));
      return;
    }

    if (!validatePhone(phone)) {
      setErrors((prev) => ({ ...prev, phone: "올바른 전화번호 형식이 아닙니다." }));
      return;
    }

    setIsLoading(true);
    setErrors({ phone: "", code: "", password: "", confirmPassword: "" });

    try {
      const response = await fetch(getFullUrl("/api/password-reset/send-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/-/g, "") }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowCodeSentPopup(true);
      } else {
        setErrors((prev) => ({ ...prev, phone: data.error || "인증번호 전송에 실패했습니다." }));
      }
    } catch (error) {
      setErrors((prev) => ({ ...prev, phone: "서버 오류가 발생했습니다." }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verificationCode.trim()) {
      setErrors((prev) => ({ ...prev, code: "인증번호를 입력해 주세요." }));
      return;
    }

    if (verificationCode.length !== 6) {
      setErrors((prev) => ({ ...prev, code: "6자리 인증번호를 입력해 주세요." }));
      return;
    }

    setIsLoading(true);
    setErrors({ phone: "", code: "", password: "", confirmPassword: "" });

    try {
      const response = await fetch(getFullUrl("/api/password-reset/verify-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/-/g, ""), code: verificationCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep("reset");
      } else {
        setErrors((prev) => ({ ...prev, code: data.error || "인증번호 확인에 실패했습니다." }));
      }
    } catch (error) {
      setErrors((prev) => ({ ...prev, code: "서버 오류가 발생했습니다." }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = {
      phone: "",
      code: "",
      password: "",
      confirmPassword: "",
    };

    if (!newPassword.trim()) {
      newErrors.password = "비밀번호를 입력해 주세요.";
    } else if (newPassword.length < 8) {
      newErrors.password = "비밀번호는 최소 8자 이상이어야 합니다.";
    } else if (newPassword.length > 20) {
      newErrors.password = "비밀번호는 최대 20자까지 입력 가능합니다.";
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = "비밀번호를 다시 입력해 주세요.";
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
    }

    setErrors(newErrors);

    if (newErrors.password || newErrors.confirmPassword) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(getFullUrl("/api/password-reset/reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/-/g, ""), code: verificationCode, newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowResetSuccessPopup(true);
      } else {
        setErrors((prev) => ({ ...prev, password: data.error || "비밀번호 재설정에 실패했습니다." }));
      }
    } catch (error) {
      setErrors((prev) => ({ ...prev, password: "서버 오류가 발생했습니다." }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSentConfirm = () => {
    setShowCodeSentPopup(false);
    setShowCodeInput(true);
  };

  const handleResetSuccessConfirm = () => {
    setShowResetSuccessPopup(false);
    setLocation("/login");
  };

  return (
    <div className="h-app-screen bg-[#111111]">
      <div className="h-[60px] flex-shrink-0 flex items-center px-5">
        <button
          onClick={() => setLocation("/login")}
          data-testid="button-back"
          className="p-1"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      </div>

      <div className="flex-1 px-5 pt-8 h-full flex overflow-y-scroll-touch" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }}>
        <div className="w-full flex-1 flex flex-col">
          <h1 className="text-white text-2xl font-bold mb-3">
            비밀번호 재설정
          </h1>
          <p className="text-[#6B6B6B] text-sm mb-10 whitespace-pre-line">
            {step === "phone"
              ? "가입할 때 등록한 전화번호로\n인증번호를 보내드립니다"
              : "새로 사용할 비밀번호를 입력해 주세요."}
          </p>

          {step === "phone" && (
            <form onSubmit={showCodeInput ? handleVerifyCode : handleSendCode} className="flex-1 flex flex-col justify-between" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 42px)' }}>
              <div className="space-y-2 mb-6">
                <Label htmlFor="phone" className="text-[#D5D5D5] text-sm">
                  전화번호
                </Label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                    <img
                      src={assets.iconUsername}
                      alt=""
                      className="w-5 h-5 object-contain"
                      data-testid="icon-phone"
                    />
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    data-testid="input-phone"
                    placeholder="010-1234-5678"
                    value={phone}
                    disabled={showCodeInput}
                    onChange={handlePhoneChange}
                    maxLength={13}
                    className={`h-12 bg-transparent border-0 border-b text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 ${
                      errors.phone
                        ? "border-b-red-500 focus-visible:border-b-red-500"
                        : "border-b-[#373539] focus-visible:border-b-[#E9E9E9]"
                    } ${showCodeInput ? "opacity-60" : ""}`}
                  />
                </div>
                {errors.phone && (
                  <p className="text-red-500 text-xs" data-testid="error-phone">
                    {errors.phone}
                  </p>
                )}
              </div>

              {showCodeInput && (
                <div className="space-y-2 mb-6">
                  <Label htmlFor="code" className="text-[#D5D5D5] text-sm">
                    인증번호
                  </Label>
                  <div className="relative flex items-center">
                    <Input
                      id="code"
                      type="text"
                      data-testid="input-verification-code"
                      placeholder="인증번호를 입력해 주세요"
                      value={verificationCode}
                      maxLength={6}
                      onChange={(e) => {
                        setVerificationCode(e.target.value);
                        setErrors((prev) => ({ ...prev, code: "" }));
                      }}
                      className={`h-12 bg-transparent border-0 border-b text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none ${
                        errors.code
                          ? "border-b-red-500 focus-visible:border-b-red-500"
                          : "border-b-[#373539] focus-visible:border-b-[#E9E9E9]"
                      }`}
                    />
                  </div>
                  {errors.code && (
                    <p className="text-red-500 text-xs" data-testid="error-code">
                      {errors.code}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                data-testid={showCodeInput ? "button-verify-code" : "button-send-code"}
                disabled={isLoading}
                className=" w-full h-12 bg-[#CDFF00] text-black font-bold rounded-lg active:bg-[#C8D48D] border border-[#CDFF00] disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
              >
                {isLoading
                  ? "처리 중..."
                  : showCodeInput
                  ? "인증하기"
                  : "인증번호 받기"}
              </button>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleResetPassword}>
              <div className="space-y-2 mb-6">
                <Label htmlFor="newPassword" className="text-[#D5D5D5] text-sm">
                  비밀번호
                </Label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                    <img
                      src={assets.iconLock}
                      alt=""
                      className="w-5 h-5 object-contain"
                      data-testid="icon-lock"
                    />
                  </div>
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    data-testid="input-new-password"
                    placeholder="비밀번호(8~20자의 영어+숫자 조합)"
                    value={newPassword}
                    maxLength={20}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setErrors((prev) => ({ ...prev, password: "" }));
                    }}
                    className={`h-12 bg-transparent border-0 border-b text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 pr-12 ${
                      errors.password
                        ? "border-b-red-500 focus-visible:border-b-red-500"
                        : "border-b-[#373539] focus-visible:border-b-[#E9E9E9]"
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
                  <p className="text-red-500 text-xs" data-testid="error-password">
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="space-y-2 mb-6">
                <Label htmlFor="confirmPassword" className="text-[#D5D5D5] text-sm">
                  비밀번호 확인
                </Label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                    <img
                      src={assets.iconLock}
                      alt=""
                      className="w-5 h-5 object-contain"
                      data-testid="icon-lock-confirm"
                    />
                  </div>
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    data-testid="input-confirm-password"
                    placeholder="비밀번호를 한번더 입력해 주세요"
                    value={confirmPassword}
                    maxLength={20}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                    }}
                    className={`h-12 bg-transparent border-0 border-b text-white placeholder:text-[#6B6B6B] focus-visible:ring-0 focus-visible:outline-none rounded-none pl-8 pr-12 ${
                      errors.confirmPassword
                        ? "border-b-red-500 focus-visible:border-b-red-500"
                        : "border-b-[#373539] focus-visible:border-b-[#E9E9E9]"
                    }`}
                  />
                  <button
                    type="button"
                    data-testid="button-toggle-confirm-password"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#D5D5D5] transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p
                    className="text-red-500 text-xs"
                    data-testid="error-confirm-password"
                  >
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="submit"
                data-testid="button-reset-password"
                disabled={isLoading}
                className="w-full h-12 bg-[#CDFF00] text-black font-bold rounded-lg active:bg-[#C8D48D] border border-[#CDFF00] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {isLoading ? "변경 중..." : "비밀번호 변경하기"}
              </button>
            </form>
          )}
        </div>
      </div>

      {showCodeSentPopup && (
        <InfoPopup
          message="인증번호가 전송되었습니다"
          buttonText="확인"
          onConfirm={handleCodeSentConfirm}
        />
      )}

      {showResetSuccessPopup && (
        <InfoPopup
          message="비밀번호가 재설정되었습니다"
          buttonText="확인"
          onConfirm={handleResetSuccessConfirm}
        />
      )}
    </div>
  );
}
