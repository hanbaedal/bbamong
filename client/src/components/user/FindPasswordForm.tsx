import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getFullUrl } from "@/lib/queryClient";

function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/[^\d]/g, "").slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
}

interface FindPasswordFormProps {
  onClose: () => void;
  onResetSuccess?: () => void;
}

export default function FindPasswordForm({ onClose, onResetSuccess }: FindPasswordFormProps) {
  const [step, setStep] = useState<"phone" | "reset" | "done">("phone");
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    phone: "",
    code: "",
    password: "",
    confirmPassword: "",
  });

  const boxClass = (hasError: boolean) =>
    hasError ? "user-login-box user-login-box--error" : "user-login-box";

  const sendCode = async () => {
    if (!phone.trim()) {
      setErrors((prev) => ({ ...prev, phone: "전화번호를 입력해 주세요." }));
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
      if (!response.ok) {
        setErrors((prev) => ({ ...prev, phone: data.error || "인증번호 전송에 실패했습니다." }));
        return;
      }
      setShowCodeInput(true);
    } catch {
      setErrors((prev) => ({ ...prev, phone: "서버 오류가 발생했습니다." }));
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!verificationCode.trim()) {
      setErrors((prev) => ({ ...prev, code: "인증번호를 입력해 주세요." }));
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
      if (!response.ok) {
        setErrors((prev) => ({ ...prev, code: data.error || "인증번호 확인에 실패했습니다." }));
        return;
      }
      setStep("reset");
    } catch {
      setErrors((prev) => ({ ...prev, code: "서버 오류가 발생했습니다." }));
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async () => {
    const nextErrors = { phone: "", code: "", password: "", confirmPassword: "" };
    if (!newPassword.trim()) {
      nextErrors.password = "비밀번호를 입력해 주세요.";
    } else if (newPassword.length < 8) {
      nextErrors.password = "비밀번호는 최소 8자 이상이어야 합니다.";
    } else if (newPassword.length > 20) {
      nextErrors.password = "비밀번호는 최대 20자까지 입력 가능합니다.";
    }
    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = "비밀번호를 다시 입력해 주세요.";
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsLoading(true);
    try {
      const response = await fetch(getFullUrl("/api/password-reset/reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/-/g, ""),
          code: verificationCode,
          newPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors((prev) => ({ ...prev, password: data.error || "비밀번호 재설정에 실패했습니다." }));
        return;
      }
      setStep("done");
      onResetSuccess?.();
    } catch {
      setErrors((prev) => ({ ...prev, password: "서버 오류가 발생했습니다." }));
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className="user-auth-recovery-form">
        <p className="user-auth-recovery-desc">비밀번호가 재설정되었습니다. 로그인해 주세요.</p>
        <button type="button" className="user-login-submit" data-testid="button-reset-done" onClick={onClose}>
          확인
        </button>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <div className="user-auth-recovery-form">
        <p className="user-auth-recovery-desc">새 비밀번호를 입력해 주세요.</p>

        <div className="user-auth-recovery-row">
          <label htmlFor="reset-password" className="user-auth-recovery-label">
            비밀번호
          </label>
          <div className="user-login-box-wrap">
            <input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              data-testid="input-new-password"
              placeholder="8자리 이상"
              value={newPassword}
              maxLength={20}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: "" }));
              }}
              className={boxClass(Boolean(errors.password))}
              style={{ paddingRight: 36 }}
            />
            <button
              type="button"
              className="user-login-box-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {errors.password ? (
          <p className="user-login-error user-auth-recovery-error" data-testid="error-password">
            {errors.password}
          </p>
        ) : null}

        <div className="user-auth-recovery-row">
          <label htmlFor="reset-confirm" className="user-auth-recovery-label">
            확인
          </label>
          <div className="user-login-box-wrap">
            <input
              id="reset-confirm"
              type={showConfirmPassword ? "text" : "password"}
              data-testid="input-confirm-password"
              placeholder="재입력"
              value={confirmPassword}
              maxLength={20}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }}
              className={boxClass(Boolean(errors.confirmPassword))}
              style={{ paddingRight: 36 }}
            />
            <button
              type="button"
              className="user-login-box-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {errors.confirmPassword ? (
          <p className="user-login-error user-auth-recovery-error" data-testid="error-confirm-password">
            {errors.confirmPassword}
          </p>
        ) : null}

        <button
          type="button"
          className="user-login-submit"
          data-testid="button-reset-password"
          disabled={isLoading}
          onClick={() => void resetPassword()}
        >
          {isLoading ? "처리 중..." : "비밀번호 변경"}
        </button>
      </div>
    );
  }

  return (
    <div className="user-auth-recovery-form">
      <p className="user-auth-recovery-desc">가입 시 등록한 전화번호로 인증합니다.</p>

      <div className="user-auth-recovery-row">
        <label htmlFor="reset-phone" className="user-auth-recovery-label">
          전화번호
        </label>
        <div className="user-auth-recovery-inline">
          <input
            id="reset-phone"
            type="tel"
            data-testid="input-phone"
            placeholder="010-0000-0000"
            value={phone}
            disabled={showCodeInput}
            onChange={(e) => {
              setPhone(formatPhoneNumber(e.target.value));
              setErrors((prev) => ({ ...prev, phone: "" }));
            }}
            className={boxClass(Boolean(errors.phone))}
          />
          {!showCodeInput ? (
            <button
              type="button"
              className="user-signup-inline-btn"
              data-testid="button-send-code"
              disabled={isLoading}
              onClick={() => void sendCode()}
            >
              {isLoading ? "전송 중..." : "인증요청"}
            </button>
          ) : null}
        </div>
      </div>
      {errors.phone ? (
        <p className="user-login-error user-auth-recovery-error" data-testid="error-phone">
          {errors.phone}
        </p>
      ) : null}

      {showCodeInput ? (
        <>
          <div className="user-auth-recovery-row">
            <label htmlFor="reset-code" className="user-auth-recovery-label">
              인증번호
            </label>
            <div className="user-auth-recovery-inline">
              <input
                id="reset-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                data-testid="input-verification-code"
                placeholder="6자리"
                value={verificationCode}
                onChange={(e) => {
                  setVerificationCode(e.target.value.replace(/[^0-9]/g, ""));
                  setErrors((prev) => ({ ...prev, code: "" }));
                }}
                className={boxClass(Boolean(errors.code))}
              />
              <button
                type="button"
                className="user-signup-inline-btn"
                data-testid="button-verify-code"
                disabled={isLoading}
                onClick={() => void verifyCode()}
              >
                {isLoading ? "확인 중..." : "확인"}
              </button>
            </div>
          </div>
          {errors.code ? (
            <p className="user-login-error user-auth-recovery-error" data-testid="error-code">
              {errors.code}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
