import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import InfoPopup from "./customUi/infoPopup";
import { clearManagerTokens } from "@/lib/managerTokenManager";
import { managerQueryClient, getFullUrl, isManagerMatchEndLogoutStarted } from "@/lib/managerQueryClient";
import { adminQueryClient } from "@/lib/adminQueryClient";
import { Capacitor } from "@capacitor/core";

type PopupType = "session-expired" | "duplicate-login" | "match-ended" | null;

export function SessionExpiredPopup() {
  const [popupType, setPopupType] = useState<PopupType>(null);
  const [redirectPath, setRedirectPath] = useState("/admin/login");
  const [matchEndedMessage, setMatchEndedMessage] = useState(
    "담당 경기가 종료되어 로그아웃되었습니다.",
  );
  const [, setLocation] = useLocation();
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const clearAdminSession = () => {
      adminQueryClient.clear();
      void fetch(getFullUrl("/api/admin/logout"), {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    };

    const handleAdminSessionExpired = () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      clearAdminSession();
      setRedirectPath("/admin/login");
      setPopupType("session-expired");
    };

    const handleManagerSessionExpired = async () => {
      if (isManagerMatchEndLogoutStarted()) return;
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      await clearManagerTokens();
      managerQueryClient.clear();
      if (!Capacitor.isNativePlatform()) {
        fetch(getFullUrl("/api/manager/clear-session"), { method: "POST", credentials: "include" }).catch(() => {});
      }
      // 검은 로그인 스플래시로 조용히 이동하지 않고, 확인 팝업을 먼저 표시
      setRedirectPath("/manager/login");
      setPopupType("session-expired");
    };

    const handleManagerMatchEnded = async (event: Event) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      const message =
        (event as CustomEvent<{ message?: string }>).detail?.message ??
        "담당 경기가 종료되어 로그아웃되었습니다.";
      try {
        sessionStorage.setItem("manager-match-ended-message", message);
      } catch {
        /* ignore */
      }
      await clearManagerTokens();
      managerQueryClient.clear();
      if (!Capacitor.isNativePlatform()) {
        fetch(getFullUrl("/api/manager/clear-session"), { method: "POST", credentials: "include" }).catch(() => {});
      }
      setMatchEndedMessage(message);
      setRedirectPath("/manager/login");
      setPopupType("match-ended");
    };

    const handleAdminDuplicateLogin = () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      clearAdminSession();
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

    window.addEventListener("admin-session-expired", handleAdminSessionExpired);
    window.addEventListener("manager-session-expired", handleManagerSessionExpired);
    window.addEventListener("manager-match-ended", handleManagerMatchEnded);
    window.addEventListener("admin-duplicate-login", handleAdminDuplicateLogin);
    window.addEventListener("manager-duplicate-login", handleManagerDuplicateLogin);

    return () => {
      window.removeEventListener("admin-session-expired", handleAdminSessionExpired);
      window.removeEventListener("manager-session-expired", handleManagerSessionExpired);
      window.removeEventListener("manager-match-ended", handleManagerMatchEnded);
      window.removeEventListener("admin-duplicate-login", handleAdminDuplicateLogin);
      window.removeEventListener("manager-duplicate-login", handleManagerDuplicateLogin);
    };
  }, []);

  const handleConfirm = async () => {
    setPopupType(null);
    isProcessingRef.current = false;
    await new Promise((resolve) => setTimeout(resolve, 0));
    setLocation(redirectPath);
  };

  if (!popupType) {
    return null;
  }

  const message =
    popupType === "duplicate-login"
      ? "다른 기기에서 로그인하여 현재 세션이 종료되었습니다."
      : popupType === "match-ended"
        ? matchEndedMessage
        : "세션이 만료되었습니다. 다시 로그인해주세요.";

  return (
    <InfoPopup
      message={message}
      buttonText="확인"
      onConfirm={handleConfirm}
    />
  );
}
