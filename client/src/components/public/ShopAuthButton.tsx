import { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { fetchMemberSessionKind } from "@/lib/appNavigation";
import { buildUserLoginUrl } from "@/lib/shopRoutes";
import { clearTokens } from "@/lib/tokenManager";
import { queryClient } from "@/lib/queryClient";

interface ShopAuthButtonProps {
  variant: "public" | "member";
  className?: string;
}

export default function ShopAuthButton({ variant, className = "" }: ShopAuthButtonProps) {
  if (variant === "member") {
    return <MemberShopAuthButton className={className} />;
  }
  return <PublicShopAuthButton className={className} />;
}

const buttonClass =
  "text-[#CDFF00] text-xs font-semibold whitespace-nowrap px-2.5 py-1 rounded border border-[#CDFF00]/40 hover:bg-[#CDFF00]/10 focus:outline-none";

function MemberShopAuthButton({ className }: { className?: string }) {
  const { logout } = useUser();

  return (
    <button
      type="button"
      onClick={async () => {
        const result = await logout();
        if (!result.nativeHandled) {
          window.location.assign("/");
        }
      }}
      data-testid="button-shop-logout"
      className={`${buttonClass} ${className}`}
    >
      로그아웃
    </button>
  );
}

function PublicShopAuthButton({ className }: { className?: string }) {
  const [isMemberLoggedIn, setIsMemberLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    void fetchMemberSessionKind().then((kind) => {
      setIsMemberLoggedIn(kind === "member");
    });
  }, []);

  if (isMemberLoggedIn === null) {
    return <div className={`w-14 h-7 ${className}`} aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={async () => {
        if (!isMemberLoggedIn) {
          const returnPath = window.location.pathname + window.location.search;
          window.location.assign(buildUserLoginUrl(returnPath, { allowGuest: false }));
          return;
        }
        await clearTokens();
        localStorage.removeItem("guest_user_id");
        queryClient.clear();
        window.location.assign("/");
      }}
      data-testid={isMemberLoggedIn ? "button-shop-logout" : "button-shop-login"}
      className={`${buttonClass} ${className}`}
    >
      {isMemberLoggedIn ? "로그아웃" : "회원 로그인"}
    </button>
  );
}
