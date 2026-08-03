import { useState } from "react";
import { getFullUrl } from "@/lib/queryClient";

function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/[^\d]/g, "").slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
}

interface FindUsernameFormProps {
  onClose: () => void;
  onUseUsername: (username: string) => void;
}

export default function FindUsernameForm({ onClose, onUseUsername }: FindUsernameFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [foundUsername, setFoundUsername] = useState<string | null>(null);
  const [maskedUsername, setMaskedUsername] = useState("");
  const [error, setError] = useState("");

  const boxClass = (hasError: boolean) =>
    hasError ? "user-login-box user-login-box--error" : "user-login-box";

  const sendCode = async () => {
    if (!name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    if (!phone.trim()) {
      setError("전화번호를 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(getFullUrl("/api/find-username/send-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.replace(/-/g, "") }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "인증번호 전송에 실패했습니다.");
        return;
      }
      setCodeSent(true);
      setCode("");
    } catch {
      setError("인증번호 전송 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      setError("인증번호를 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(getFullUrl("/api/find-username/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.replace(/-/g, ""),
          code: code.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "인증에 실패했습니다.");
        return;
      }
      setFoundUsername(data.username);
      setMaskedUsername(data.maskedUsername);
    } catch {
      setError("인증 확인 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (foundUsername) {
    return (
      <div className="user-auth-recovery-form">
        <p className="user-auth-recovery-desc">회원님의 아이디는 아래와 같습니다.</p>
        <p className="user-auth-recovery-result" data-testid="text-found-username">
          {maskedUsername}
        </p>
        <button
          type="button"
          className="user-login-submit"
          data-testid="button-use-found-username"
          onClick={() => {
            onUseUsername(foundUsername);
            onClose();
          }}
        >
          로그인에 사용
        </button>
      </div>
    );
  }

  return (
    <div className="user-auth-recovery-form">
      <p className="user-auth-recovery-desc">가입 시 등록한 이름과 전화번호로 인증합니다.</p>

      <div className="user-auth-recovery-row">
        <label htmlFor="find-name" className="user-auth-recovery-label">
          이름
        </label>
        <input
          id="find-name"
          type="text"
          data-testid="input-find-name"
          placeholder="이름"
          value={name}
          disabled={codeSent}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          className={boxClass(Boolean(error && !name.trim()))}
        />
      </div>

      <div className="user-auth-recovery-row">
        <label htmlFor="find-phone" className="user-auth-recovery-label">
          전화번호
        </label>
        <div className="user-auth-recovery-inline">
          <input
            id="find-phone"
            type="tel"
            data-testid="input-find-phone"
            placeholder="010-0000-0000"
            value={phone}
            disabled={codeSent}
            onChange={(e) => {
              setPhone(formatPhoneNumber(e.target.value));
              setError("");
            }}
            className={boxClass(Boolean(error && !phone.trim()))}
          />
          {!codeSent ? (
            <button
              type="button"
              className="user-signup-inline-btn"
              data-testid="button-find-send-code"
              disabled={isLoading}
              onClick={() => void sendCode()}
            >
              {isLoading ? "전송 중..." : "인증요청"}
            </button>
          ) : null}
        </div>
      </div>

      {codeSent ? (
        <div className="user-auth-recovery-row">
          <label htmlFor="find-code" className="user-auth-recovery-label">
            인증번호
          </label>
          <div className="user-auth-recovery-inline">
            <input
              id="find-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              data-testid="input-find-code"
              placeholder="6자리"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/[^0-9]/g, ""));
                setError("");
              }}
              className={boxClass(Boolean(error))}
            />
            <button
              type="button"
              className="user-signup-inline-btn"
              data-testid="button-find-verify-code"
              disabled={isLoading}
              onClick={() => void verifyCode()}
            >
              {isLoading ? "확인 중..." : "확인"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="user-login-error user-auth-recovery-error" data-testid="error-find-username">
          {error}
        </p>
      ) : null}
    </div>
  );
}
