import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import InfoPopup from "./customUi/infoPopup";
import { USER_LOGIN_PATH, isUserAuthPublicPath } from "@/lib/loginSession";
import { queryClient } from "@/lib/queryClient";
import { clearTokens } from "@/lib/tokenManager";

type PopupType = "session-expired" | "duplicate-login" | null;

/** 사용자(게임) 앱 전용 — JWT 세션 만료·중복 로그인 */
export default function UserSessionExpiredPopup() {
  const [popupType, setPopupType] = useState<PopupType>(null);
  const [, setLocation] = useLocation();
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const clearUserSession = async () => {
      await clearTokens();
      queryClient.clear();
    };

    const handleUserSessionExpired = () => {
      if (isUserAuthPublicPath()) return;
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      void clearUserSession();
      setPopupType("session-expired");
    };

    const handleUserDuplicateLogin = () => {
      if (isUserAuthPublicPath()) return;
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      void clearUserSession();
      setPopupType("duplicate-login");
    };

    window.addEventListener("user-session-expired", handleUserSessionExpired);
    window.addEventListener("user-duplicate-login", handleUserDuplicateLogin);

    return () => {
      window.removeEventListener("user-session-expired", handleUserSessionExpired);
      window.removeEventListener("user-duplicate-login", handleUserDuplicateLogin);
    };
  }, []);

  const handleConfirm = async () => {
    setPopupType(null);
    isProcessingRef.current = false;
    await new Promise((resolve) => setTimeout(resolve, 0));
    setLocation(USER_LOGIN_PATH);
  };

  if (!popupType) return null;

  const message =
    popupType === "duplicate-login"
      ? "다른 기기에서 로그인하여 현재 세션이 종료되었습니다."
      : "세션이 만료되었습니다. 다시 로그인해주세요.";

  return <InfoPopup message={message} buttonText="확인" onConfirm={handleConfirm} />;
}
