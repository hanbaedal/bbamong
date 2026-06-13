import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import InfoPopup from "./customUi/infoPopup";
import { clearManagerTokens } from "@/lib/managerTokenManager";
import { managerQueryClient, getFullUrl } from "@/lib/managerQueryClient";
import { Capacitor } from "@capacitor/core";

type PopupType = "session-expired" | "duplicate-login" | null;

export function SessionExpiredPopup() {
  const [popupType, setPopupType] = useState<PopupType>(null);
  const [redirectPath, setRedirectPath] = useState("/admin/login");
  const [, setLocation] = useLocation();
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const handleAdminSessionExpired = () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setRedirectPath("/admin/login");
      setPopupType("session-expired");
    };

    const handleManagerSessionExpired = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      await clearManagerTokens();
      managerQueryClient.clear();
      if (!Capacitor.isNativePlatform()) {
        fetch(getFullUrl("/api/manager/clear-session"), { method: "POST", credentials: "include" }).catch(() => {});
      }
      isProcessingRef.current = false;
      setLocation("/manager/login");
    };

    const handleUserSessionExpired = () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setRedirectPath("/");
      setPopupType("session-expired");
    };

    const handleAdminDuplicateLogin = () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setRedirectPath("/admin/login");
      setPopupType("duplicate-login");
    };

    const handleManagerDuplicateLogin = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      await clearManagerTokens();
      managerQueryClient.clear();
      if (!Capacitor.isNativePlatform()) {
        fetch(getFullUrl("/api/manager/clear-session"), { method: "POST", credentials: "include" }).catch(() => {});
      }
      setRedirectPath("/manager/login");
      setPopupType("duplicate-login");
    };

    const handleUserDuplicateLogin = () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setRedirectPath("/");
      setPopupType("duplicate-login");
    };

    window.addEventListener("admin-session-expired", handleAdminSessionExpired);
    window.addEventListener("manager-session-expired", handleManagerSessionExpired);
    window.addEventListener("user-session-expired", handleUserSessionExpired);
    window.addEventListener("admin-duplicate-login", handleAdminDuplicateLogin);
    window.addEventListener("manager-duplicate-login", handleManagerDuplicateLogin);
    window.addEventListener("user-duplicate-login", handleUserDuplicateLogin);

    return () => {
      window.removeEventListener("admin-session-expired", handleAdminSessionExpired);
      window.removeEventListener("manager-session-expired", handleManagerSessionExpired);
      window.removeEventListener("user-session-expired", handleUserSessionExpired);
      window.removeEventListener("admin-duplicate-login", handleAdminDuplicateLogin);
      window.removeEventListener("manager-duplicate-login", handleManagerDuplicateLogin);
      window.removeEventListener("user-duplicate-login", handleUserDuplicateLogin);
    };
  }, []);

  const handleConfirm = async () => {
    setPopupType(null);
    isProcessingRef.current = false;
    await new Promise(resolve => setTimeout(resolve, 0));
    setLocation(redirectPath);
  };

  if (!popupType) {
    return null;
  }

  const message = popupType === "duplicate-login"
    ? "다른 기기에서 로그인하여 현재 세션이 종료되었습니다."
    : "세션이 만료되었습니다. 다시 로그인해주세요.";

  return (
    <InfoPopup
      message={message}
      buttonText="확인"
      onConfirm={handleConfirm}
    />
  );
}
