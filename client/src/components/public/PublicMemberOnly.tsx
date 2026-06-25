import { useEffect, useState, type ReactNode } from "react";
import { fetchMemberSessionKind } from "@/lib/appNavigation";
import { buildUserLoginUrl } from "@/lib/shopRoutes";

interface PublicMemberOnlyProps {
  children: ReactNode;
  message?: string;
  className?: string;
}

/** 공개 쇼핑몰: 회원만 children 표시, 비회원·게스트는 로그인 CTA */
export default function PublicMemberOnly({
  children,
  message = "구매·문의는 회원 로그인이 필요합니다",
  className = "",
}: PublicMemberOnlyProps) {
  const [isMember, setIsMember] = useState<boolean | null>(null);

  useEffect(() => {
    void fetchMemberSessionKind().then((kind) => {
      setIsMember(kind === "member");
    });
  }, []);

  if (isMember === null) {
    return (
      <div className={`mt-6 pt-4 border-t border-[#333] h-20 ${className}`} aria-hidden />
    );
  }

  if (!isMember) {
    const returnPath = window.location.pathname + window.location.search;
    return (
      <div
        className={`mt-6 pt-4 border-t border-[#333] text-center ${className}`}
        data-testid="public-member-only-gate"
      >
        <p className="text-[#888] text-xs mb-3">{message}</p>
        <button
          type="button"
          onClick={() =>
            window.location.assign(buildUserLoginUrl(returnPath, { allowGuest: false }))
          }
          className="w-full py-3 rounded-lg bg-[#CDFF00] text-black font-bold text-sm"
          data-testid="button-public-member-only-login"
        >
          회원 로그인
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
