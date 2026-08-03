import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getFullUrl, resetManagerRefreshCooldown } from "@/lib/managerQueryClient";
import { Capacitor } from "@capacitor/core";
import { setManagerAccessToken, saveManagerRefreshToken } from "@/lib/managerTokenManager";
import splashIcon from "@assets/manager/manager-mascot.png";
import {
  operatorLoginDuringMessage,
  operatorLoginSuccessMessage,
  speakKorean,
} from "@/lib/operatorLoginMessages";

function extractLoginTokenFromUrl(rawUrl: string): string | null {
  try {
    const normalized = rawUrl.includes("://")
      ? rawUrl
      : `https://dummy${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
    const url = new URL(normalized);
    const fromQuery = url.searchParams.get("t");
    if (fromQuery?.trim()) return fromQuery.trim();
  } catch {
    /* ignore */
  }
  return null;
}

type LinkLoginPhase = "waiting" | "loading" | "success" | "error";

const loginLinkInFlight = new Map<string, Promise<void>>();

export default function ManagerLoginPage() {
  const [location, setLocation] = useLocation();
  const [linkLoginPhase, setLinkLoginPhase] = useState<LinkLoginPhase>("waiting");
  const [linkLoginMessage, setLinkLoginMessage] = useState(
    "카카오톡으로 받은 로그인 링크를 눌러 주세요.",
  );

  useEffect(() => {
    try {
      const endedMessage = sessionStorage.getItem("manager-match-ended-message");
      if (endedMessage) {
        sessionStorage.removeItem("manager-match-ended-message");
        setLinkLoginMessage(endedMessage);
        setLinkLoginPhase("error");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const finishLoginSuccess = async (data: { accessToken?: string; refreshToken?: string }) => {
    resetManagerRefreshCooldown();
    if (Capacitor.isNativePlatform() && data.accessToken && data.refreshToken) {
      setManagerAccessToken(data.accessToken);
      await saveManagerRefreshToken(data.refreshToken);
    }
    setLocation("/manager/home", { replace: true });
  };

  const loginWithLinkToken = async (token: string) => {
    const existing = loginLinkInFlight.get(token);
    if (existing) {
      await existing.catch(() => undefined);
      return;
    }

    const run = (async () => {
      setLinkLoginPhase("loading");
      setLinkLoginMessage(operatorLoginDuringMessage());

      try {
        try {
          const previewRes = await fetch(
            getFullUrl(`/api/manager/login-link-preview/${encodeURIComponent(token)}`),
          );
          if (previewRes.ok) {
            const preview = await previewRes.json();
            setLinkLoginMessage(
              operatorLoginDuringMessage(preview.assignedMatchNumber, preview.operatorSlot),
            );
          }
        } catch {
          /* preview optional */
        }

        const response = await fetch(getFullUrl("/api/manager/login-with-link"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        const data = await response.json();

        if (response.ok) {
          window.history.replaceState({}, "", "/manager/login");
          const successMessage = operatorLoginSuccessMessage(
            data.assignedMatchNumber,
            data.operatorSlot,
          );
          setLinkLoginPhase("success");
          setLinkLoginMessage(successMessage);
          void speakKorean(successMessage);
          await finishLoginSuccess(data);
          return;
        }

        setLinkLoginPhase("error");
        setLinkLoginMessage(
          data.error || "자동 로그인에 실패했습니다. 관리자에게 새 링크를 요청하세요.",
        );
      } catch {
        setLinkLoginPhase("error");
        setLinkLoginMessage("자동 로그인 중 오류가 발생했습니다. 관리자에게 새 링크를 요청하세요.");
      }
    })();

    loginLinkInFlight.set(token, run);
    try {
      await run;
    } finally {
      loginLinkInFlight.delete(token);
    }
  };

  useEffect(() => {
    const token =
      extractLoginTokenFromUrl(window.location.href) ||
      extractLoginTokenFromUrl(location);
    if (token) {
      void loginWithLinkToken(token);
    }
  }, [location]);

  const keepErrorOnOneLine =
    linkLoginPhase === "error" && linkLoginMessage.startsWith("담당 경기가 종료");

  return (
    <div
      className="fixed inset-0 bg-[#111111] flex flex-col items-center justify-center px-8"
      data-testid="link-login-splash"
      style={{
        paddingTop: "max(env(safe-area-inset-top, 0px), 44px)",
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 32px)",
      }}
    >
      <img
        src={splashIcon}
        alt="PPAMONG 운영자"
        className={`w-32 h-auto mb-6 object-contain ${
          linkLoginPhase === "loading" ? "animate-pulse" : ""
        }`}
        data-testid="img-link-login-mascot"
      />
      <p
        className={`font-semibold text-center ${
          linkLoginPhase === "error"
            ? keepErrorOnOneLine
              ? "whitespace-nowrap text-[15px] text-[#FF8A8A] sm:text-lg"
              : "max-w-[320px] text-base leading-relaxed text-[#FF8A8A] sm:text-lg"
            : "max-w-[320px] text-lg leading-relaxed text-[#E9E9E9]"
        }`}
        data-testid="text-link-login-message"
      >
        {linkLoginMessage}
      </p>
      {linkLoginPhase === "loading" && (
        <div
          className="mt-6 w-10 h-10 border-[3px] border-[#333] border-t-[#CDFF00] rounded-full animate-spin"
          aria-hidden
        />
      )}
      {linkLoginPhase === "waiting" && (
        <p className="mt-4 text-sm text-[#888] text-center max-w-[280px]">
          카카오톡으로 받은 링크·비밀번호는 담당 경기가 끝나기 전까지 사용할 수 있습니다.
        </p>
      )}
    </div>
  );
}
