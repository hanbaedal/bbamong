import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { getFullUrl, getOrRefreshAccessToken } from "@/lib/queryClient";
import { notifyUserLoginAttemptSafe } from "@/lib/sessionGuard";
import { isUserAuthPublicPath } from "@/lib/loginSession";

const POLL_INTERVAL_MS = 45_000;
const LOGIN_ATTEMPT_MESSAGE =
  "다른 곳에서 로그인을 시도했습니다. 본인이 아니면 비밀번호를 변경해 주세요.";

/**
 * 활성 기기에서 차단된 로그인 시도를 감지해 토스트로 알린다.
 * - 경기 WS `login_attempt`
 * - `/api/users/me` 폴링·포커스
 * - `user-login-attempt` 커스텀 이벤트
 */
export default function UserLoginAttemptNotice() {
  const { toast } = useToast();
  const { user, isUserLoaded } = useUser();
  const lastShownAtRef = useRef(0);

  const showNotice = () => {
    const now = Date.now();
    if (now - lastShownAtRef.current < 8_000) return;
    lastShownAtRef.current = now;
    toast({
      title: "로그인 시도 감지",
      description: LOGIN_ATTEMPT_MESSAGE,
      variant: "destructive",
    });
  };

  useEffect(() => {
    const onAttempt = () => showNotice();
    window.addEventListener("user-login-attempt", onAttempt);
    return () => window.removeEventListener("user-login-attempt", onAttempt);
  }, []);

  useEffect(() => {
    if (!isUserLoaded || !user || isUserAuthPublicPath()) return;

    let cancelled = false;

    const checkMe = async () => {
      if (cancelled || isUserAuthPublicPath()) return;
      try {
        const token = await getOrRefreshAccessToken();
        if (!token || cancelled) return;
        const res = await fetch(getFullUrl("/api/users/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { recentLoginAttempt?: boolean };
        if (data.recentLoginAttempt) {
          notifyUserLoginAttemptSafe();
        }
      } catch {
        // ignore
      }
    };

    void checkMe();
    const intervalId = window.setInterval(() => void checkMe(), POLL_INTERVAL_MS);
    const onFocus = () => void checkMe();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [isUserLoaded, user?.id]);

  return null;
}
