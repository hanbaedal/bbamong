import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/contexts/UserContext";
import { navigateEmbed } from "@/lib/gameEmbed";
import { apiRequest } from "@/lib/queryClient";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";

/** 게임 split 우측 — 회원정보 본인 확인 (한 화면) */
export default function VerifyIdentityCompact() {
  const [, setLocation] = useLocation();
  const { user, isGuest } = useUser();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);

  const [username, setUsername] = useState(user?.username || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const noPasswordAccount = Boolean(user && user.hasPassword === false);

  const handleVerify = async () => {
    if (checkGuest()) return;

    if (noPasswordAccount) {
      setError("비밀번호가 없는 계정입니다. 소셜 로그인 계정은 고객센터로 문의해 주세요.");
      return;
    }

    if (!username.trim() || !password.trim()) {
      setError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiRequest("POST", "/api/verify-identity", {
        username: username.trim(),
        password,
      });
      const data = await response.json();

      if (data.verified) {
        sessionStorage.setItem("profileVerified", Date.now().toString());
        navigateEmbed("/profile", setLocation);
      } else {
        setError(data.error || "아이디 또는 비밀번호가 일치하지 않습니다.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "본인 확인 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="profile-verify-compact" data-testid="verify-identity-compact">
      <div className="profile-verify-compact__head">
        <h2 className="profile-verify-compact__title" data-testid="text-page-title">
          본인 확인
        </h2>
        <p className="profile-verify-compact__desc" data-testid="text-page-description">
          회원정보 수정을 위해 로그인 비밀번호를 입력해 주세요.
        </p>
      </div>

      <form
        className="profile-verify-compact__form"
        onSubmit={(e) => {
          e.preventDefault();
          void handleVerify();
        }}
      >
        <div className="profile-verify-compact__field">
          <Label htmlFor="verify-username-compact" className="profile-verify-compact__label">
            아이디
          </Label>
          <Input
            id="verify-username-compact"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError("");
            }}
            placeholder="아이디"
            data-testid="input-verify-username"
            className="profile-verify-compact__input"
            autoComplete="username"
          />
        </div>

        <div className="profile-verify-compact__field">
          <Label htmlFor="verify-password-compact" className="profile-verify-compact__label">
            비밀번호
          </Label>
          <div className="profile-verify-compact__password-wrap">
            <Input
              id="verify-password-compact"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="비밀번호"
              data-testid="input-verify-password"
              className="profile-verify-compact__input profile-verify-compact__input--password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              data-testid="button-toggle-password"
              className="profile-verify-compact__eye"
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {error ? (
          <p className="profile-verify-compact__error" data-testid="text-verify-error">
            {error}
          </p>
        ) : null}

        {noPasswordAccount ? (
          <p className="profile-verify-compact__hint">
            이 계정은 비밀번호가 없습니다. 일반 회원 로그인 계정만 수정할 수 있습니다.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isLoading || noPasswordAccount}
          data-testid="button-verify"
          className="profile-verify-compact__submit"
        >
          {isLoading ? "확인 중…" : "확인"}
        </button>
      </form>

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />
    </div>
  );
}
