import { useEffect, useState } from "react";
import { fetchMemberSessionKind } from "@/lib/appNavigation";
import { buildUserLoginUrl } from "@/lib/shopRoutes";

export default function PublicMemberLoginBanner() {
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    void fetchMemberSessionKind().then((kind) => {
      setNeedsLogin(kind !== "member");
    });
  }, []);

  if (!needsLogin) return null;

  const returnPath = window.location.pathname + window.location.search;

  return (
    <div
      className="mb-4 p-3 rounded-lg bg-[#1A1A1A] border border-[#333] text-center"
      data-testid="public-member-login-banner"
    >
      <p className="text-[#888] text-xs mb-2">구매·문의는 회원 로그인이 필요합니다</p>
      <button
        type="button"
        onClick={() =>
          window.location.assign(buildUserLoginUrl(returnPath, { allowGuest: false }))
        }
        className="text-[#CDFF00] text-xs font-semibold underline"
        data-testid="button-public-member-login"
      >
        회원 로그인
      </button>
    </div>
  );
}
