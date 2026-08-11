import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, getFullUrl } from "@/lib/queryClient";
import { getAccessToken } from "@/lib/tokenManager";
import { useToast } from "@/hooks/use-toast";
import debounce from "lodash.debounce";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";
import { navigateEmbed } from "@/lib/gameEmbed";
import "@/styles/user-landscape.css";

type NicknameStatus = "idle" | "checking" | "available" | "unavailable";
type UsernameStatus = "idle" | "checking" | "available" | "unavailable";

const boxErrorClass = (hasError: boolean) =>
  hasError ? "user-login-box user-login-box--error" : "user-login-box";

/**
 * 게임 split 우측 — 회원정보 수정
 * 회원가입 우측 폼(user-signup-panel)과 동일한 카드/필드 UI
 */
export default function ProfileCompact() {
  const [, setLocation] = useLocation();
  const { user, setUser, isGuest } = useUser();
  const { toast } = useToast();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);

  useEffect(() => {
    const verified = sessionStorage.getItem("profileVerified");
    if (!verified) {
      navigateEmbed("/verify-identity", setLocation);
      return;
    }
    const elapsed = Date.now() - parseInt(verified, 10);
    if (elapsed > 10 * 60 * 1000) {
      sessionStorage.removeItem("profileVerified");
      navigateEmbed("/verify-identity", setLocation);
    }
  }, [setLocation]);

  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>("idle");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [formData, setFormData] = useState({
    username: user?.username || "",
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    password: "",
    confirmPassword: "",
  });
  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showVerificationInput, setShowVerificationInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationTimer, setVerificationTimer] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [phoneChanged, setPhoneChanged] = useState(false);
  const [originalPhone, setOriginalPhone] = useState("");
  const [errors, setErrors] = useState({
    name: "",
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    phone: "",
  });

  const checkNickname = useCallback(
    debounce(async (name: string) => {
      if (!name.trim() || name.trim() === user?.name) {
        setNicknameStatus("idle");
        return;
      }
      setNicknameStatus("checking");
      try {
        const response = await apiRequest("POST", "/api/check-nickname", {
          name: name.trim(),
          userId: user?.id,
        });
        const data = await response.json();
        setNicknameStatus(data.available ? "available" : "unavailable");
      } catch {
        setNicknameStatus("idle");
      }
    }, 500),
    [user?.id, user?.name],
  );

  const checkUsername = useCallback(
    debounce(async (username: string) => {
      if (!username.trim() || username.trim() === user?.username) {
        setUsernameStatus("idle");
        return;
      }
      setUsernameStatus("checking");
      try {
        const response = await apiRequest("POST", "/api/check-username", {
          username: username.trim(),
        });
        const data = await response.json();
        setUsernameStatus(data.available ? "available" : "unavailable");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500),
    [user?.username],
  );

  useEffect(() => {
    if (!user) return;
    const formatted = formatPhoneNumber(user.phone || "");
    setFormData({
      username: user.username,
      name: user.name,
      email: user.email || "",
      phone: formatted,
      password: "",
      confirmPassword: "",
    });
    setOriginalPhone(user.phone || "");
    setPhoneChanged(false);
    setIsPhoneVerified(false);
    setShowVerificationInput(false);
  }, [user]);

  useEffect(() => {
    if (formData.name !== user?.name && formData.name.trim()) checkNickname(formData.name);
    else setNicknameStatus("idle");
  }, [formData.name, user?.name, checkNickname]);

  useEffect(() => {
    if (formData.username !== user?.username && formData.username.trim()) {
      checkUsername(formData.username);
    } else setUsernameStatus("idle");
  }, [formData.username, user?.username, checkUsername]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (verificationTimer > 0) {
      interval = setInterval(() => {
        setVerificationTimer((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [verificationTimer]);

  useEffect(() => {
    if (!user?.id) return;
    const token = getAccessToken();
    if (!token) return;
    fetch(getFullUrl("/api/users/me"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.referralCode) setReferralCode(data.user.referralCode);
      })
      .catch(() => {});
  }, [user?.id]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  function formatPhoneNumber(value: string) {
    const numbers = value.replace(/[^\d]/g, "").slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  }

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, phone: formatted });
    const cleanNew = formatted.replace(/-/g, "");
    const changed = cleanNew !== originalPhone;
    setPhoneChanged(changed);
    if (changed) {
      setIsPhoneVerified(false);
      setShowVerificationInput(false);
      setVerificationTimer(0);
      setVerificationCode("");
    }
    setErrors((prev) => ({ ...prev, phone: "" }));
  };

  const sendVerificationCode = async () => {
    const cleanPhone = formData.phone.replace(/-/g, "");
    if (!cleanPhone.trim()) {
      setErrors((prev) => ({ ...prev, phone: "전화번호를 입력해 주세요." }));
      return;
    }
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
    } catch {
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
    const cleanPhone = formData.phone.replace(/-/g, "");
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
    } catch {
      setErrors((prev) => ({ ...prev, phone: "인증 확인 중 오류가 발생했습니다." }));
    } finally {
      setIsVerifying(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("사용자 정보가 없습니다.");
      const body: Record<string, string> = {};
      if (formData.username && formData.username !== user.username) {
        if (usernameStatus === "unavailable") throw new Error("이미 사용 중인 아이디입니다.");
        if (usernameStatus === "checking") throw new Error("아이디 중복 확인 중입니다.");
        body.username = formData.username.trim();
      }
      if (formData.name && formData.name !== user.name) body.name = formData.name;
      if (formData.email && formData.email !== (user.email || "")) {
        if (!validateEmail(formData.email)) throw new Error("올바른 이메일 형식이 아닙니다.");
        body.email = formData.email;
      }
      if (phoneChanged) {
        const cleanPhone = formData.phone.replace(/-/g, "");
        if (!isPhoneVerified) throw new Error("전화번호 인증을 완료해 주세요.");
        body.phone = cleanPhone;
      }
      if (formData.password) {
        if (formData.password.length < 8) throw new Error("비밀번호는 최소 8자 이상이어야 합니다.");
        if (formData.password !== formData.confirmPassword) {
          throw new Error("비밀번호가 일치하지 않습니다.");
        }
        body.password = formData.password;
        body.confirmPassword = formData.confirmPassword;
      }
      if (Object.keys(body).length === 0) throw new Error("변경된 정보가 없습니다.");
      const response = await apiRequest("PATCH", `/api/users/${user.id}`, body);
      return response.json() as Promise<{ success: boolean; message: string; user: any }>;
    },
    onSuccess: (data) => {
      if (data.success && user) {
        setUser({
          ...user,
          username: data.user.username,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          hasPassword: data.user.hasPassword ?? user.hasPassword,
        });
        setOriginalPhone(data.user.phone);
        setPhoneChanged(false);
        setIsPhoneVerified(false);
        setShowVerificationInput(false);
        setFormData((prev) => ({ ...prev, password: "", confirmPassword: "" }));
        toast({ title: "성공", description: data.message });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "오류",
        description: error.message || "정보 수정에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const newErrors = {
      name: "",
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      phone: "",
    };
    if (!formData.name.trim()) newErrors.name = "이름을 입력해주세요.";
    else if (formData.name.length > 15) newErrors.name = "이름은 최대 15자까지 입력 가능합니다.";
    else if (nicknameStatus === "unavailable") newErrors.name = "이미 사용중인 닉네임입니다.";

    if (formData.username !== user?.username && usernameStatus === "unavailable") {
      newErrors.username = "이미 사용 중인 아이디입니다.";
    }

    if (formData.password) {
      if (formData.password.length < 8) newErrors.password = "비밀번호는 최소 8자 이상이어야 합니다.";
      if (!formData.confirmPassword) newErrors.confirmPassword = "비밀번호를 다시 입력해 주세요.";
      else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
      }
    }
    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = "올바른 이메일 형식이 아닙니다.";
    }
    if (phoneChanged && !isPhoneVerified) newErrors.phone = "전화번호 인증을 완료해 주세요.";

    setErrors(newErrors);
    if (Object.values(newErrors).some((e) => e !== "")) return;
    if (nicknameStatus === "checking" || usernameStatus === "checking") {
      toast({ title: "알림", description: "중복 확인 중입니다. 잠시 후 다시 시도해주세요." });
      return;
    }
    if (checkGuest()) return;
    updateMutation.mutate();
  };

  const passwordLabel =
    user?.provider && user.provider !== "local" && !user.hasPassword
      ? "비밀번호 설정"
      : "비밀번호 변경";

  return (
    <div className="profile-edit-compact" data-testid="profile-edit-compact">
      <form
        className="user-signup-panel profile-edit-signup-panel"
        data-testid="profile-edit-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div className="user-login-card">
          <div className="user-login-field">
            <label htmlFor="profile-name" className="user-login-field-label">
              이름
            </label>
            <input
              id="profile-name"
              type="text"
              data-testid="input-name"
              placeholder="이름 (최대 15자)"
              value={formData.name}
              maxLength={15}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                setErrors((prev) => ({ ...prev, name: "" }));
              }}
              className={boxErrorClass(Boolean(errors.name) || nicknameStatus === "unavailable")}
              autoComplete="name"
            />
            {nicknameStatus === "available" ? (
              <p className="user-signup-success" data-testid="text-nickname-success">
                사용 가능한 닉네임입니다.
              </p>
            ) : nicknameStatus === "checking" ? (
              <p className="user-signup-success" data-testid="text-nickname-checking">
                확인 중...
              </p>
            ) : errors.name || nicknameStatus === "unavailable" ? (
              <p className="user-login-error user-login-error--card" data-testid="error-name">
                {errors.name || "이미 사용중인 닉네임입니다."}
              </p>
            ) : null}
          </div>

          <div className="user-login-field">
            <label htmlFor="profile-username" className="user-login-field-label">
              아이디
            </label>
            <input
              id="profile-username"
              type="text"
              data-testid="input-username"
              placeholder="아이디"
              value={formData.username}
              onChange={(e) => {
                setFormData({ ...formData, username: e.target.value });
                setErrors((prev) => ({ ...prev, username: "" }));
              }}
              className={boxErrorClass(
                Boolean(errors.username) || usernameStatus === "unavailable",
              )}
              autoComplete="username"
            />
            {usernameStatus === "available" ? (
              <p className="user-signup-success" data-testid="text-username-success">
                사용 가능한 아이디입니다.
              </p>
            ) : usernameStatus === "checking" ? (
              <p className="user-signup-success" data-testid="text-username-checking">
                확인 중...
              </p>
            ) : errors.username || usernameStatus === "unavailable" ? (
              <p className="user-login-error user-login-error--card" data-testid="error-username">
                {errors.username || "이미 사용 중인 아이디입니다."}
              </p>
            ) : null}
          </div>

          <div className="user-login-field">
            <label htmlFor="profile-password" className="user-login-field-label">
              {passwordLabel}
            </label>
            <div className="user-login-box-wrap">
              <input
                id="profile-password"
                type={showPassword ? "text" : "password"}
                data-testid="input-password"
                placeholder="8자리 이상 (변경 시)"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  setErrors((prev) => ({ ...prev, password: "" }));
                }}
                className={boxErrorClass(Boolean(errors.password))}
                style={{ paddingRight: 36 }}
                autoComplete="new-password"
              />
              <button
                type="button"
                data-testid="button-toggle-password"
                onClick={() => setShowPassword((v) => !v)}
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
            <label htmlFor="profile-confirm-password" className="user-login-field-label">
              비밀번호 확인
            </label>
            <div className="user-login-box-wrap">
              <input
                id="profile-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                data-testid="input-confirm-password"
                placeholder="비밀번호 재입력"
                value={formData.confirmPassword}
                onChange={(e) => {
                  setFormData({ ...formData, confirmPassword: e.target.value });
                  setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                }}
                className={boxErrorClass(Boolean(errors.confirmPassword))}
                style={{ paddingRight: 36 }}
                autoComplete="new-password"
              />
              <button
                type="button"
                data-testid="button-toggle-confirm-password"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="user-login-box-toggle"
                aria-label={showConfirmPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
            <label htmlFor="profile-phone" className="user-login-field-label">
              전화번호
            </label>
            <div className={phoneChanged && !isPhoneVerified ? "user-signup-inline-field" : "user-login-box-wrap"}>
              <input
                id="profile-phone"
                type="tel"
                data-testid="input-phone"
                placeholder="010-0000-0000"
                value={formData.phone}
                disabled={isPhoneVerified && phoneChanged}
                onChange={handlePhoneChange}
                className={boxErrorClass(Boolean(errors.phone && !(isPhoneVerified && phoneChanged)))}
                autoComplete="tel"
              />
              {phoneChanged && !isPhoneVerified ? (
                <button
                  type="button"
                  onClick={() => void sendVerificationCode()}
                  disabled={isSendingCode}
                  data-testid="button-send-verification"
                  className="user-signup-inline-btn"
                >
                  {isSendingCode ? "전송 중..." : showVerificationInput ? "재요청" : "인증요청"}
                </button>
              ) : null}
            </div>

            {showVerificationInput && phoneChanged && !isPhoneVerified ? (
              <div className="user-signup-verify-row">
                <div className="user-login-box-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    data-testid="input-verification-code"
                    placeholder="인증번호 6자리"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))}
                    className={boxErrorClass(false)}
                  />
                  {verificationTimer > 0 ? (
                    <span className="user-signup-verify-timer" data-testid="text-verification-timer">
                      {formatTimer(verificationTimer)}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void verifyCode()}
                  disabled={isVerifying || verificationTimer === 0}
                  data-testid="button-verify-code"
                  className="user-signup-inline-btn"
                >
                  {isVerifying ? "확인 중..." : "인증하기"}
                </button>
              </div>
            ) : null}

            {isPhoneVerified && phoneChanged ? (
              <p className="user-signup-success" data-testid="text-phone-verified">
                인증되었습니다.
              </p>
            ) : errors.phone ? (
              <p className="user-login-error user-login-error--card" data-testid="error-phone">
                {errors.phone}
              </p>
            ) : showVerificationInput && phoneChanged && verificationTimer === 0 ? (
              <p className="user-login-error user-login-error--card">
                인증시간이 만료되었습니다. 재요청 버튼을 눌러주세요.
              </p>
            ) : null}
          </div>

          <div className="user-login-field">
            <label htmlFor="profile-email" className="user-login-field-label">
              이메일
            </label>
            <input
              id="profile-email"
              type="email"
              data-testid="input-email"
              placeholder="이메일"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                setErrors((prev) => ({ ...prev, email: "" }));
              }}
              className={boxErrorClass(Boolean(errors.email))}
              autoComplete="email"
            />
            {errors.email ? (
              <p className="user-login-error user-login-error--card" data-testid="error-email">
                {errors.email}
              </p>
            ) : null}
          </div>

          <div className="user-login-field">
            <label htmlFor="profile-referral" className="user-login-field-label">
              추천인
            </label>
            <input
              id="profile-referral"
              type="text"
              data-testid="input-referral-code"
              value={referralCode || ""}
              readOnly
              disabled
              placeholder="추천인 코드 없음"
              className="user-login-box"
            />
          </div>
        </div>

        <button
          type="submit"
          data-testid="button-save"
          disabled={
            updateMutation.isPending ||
            nicknameStatus === "unavailable" ||
            usernameStatus === "unavailable"
          }
          className="user-signup-submit"
        >
          {updateMutation.isPending ? "저장 중..." : "저장"}
        </button>
      </form>

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />
    </div>
  );
}
