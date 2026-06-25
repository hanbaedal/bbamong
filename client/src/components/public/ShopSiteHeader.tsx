import type { ReactNode } from "react";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { navigateToGame } from "@/lib/appNavigation";
import ShopAuthButton from "@/components/public/ShopAuthButton";
import StaffAuthLinks from "@/components/public/StaffAuthLinks";

interface ShopSiteHeaderProps {
  title?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  /** public: 공개 홈페이지, member: 회원 앱 쇼핑몰 */
  variant?: "public" | "member";
  showAuthButton?: boolean;
  /**
   * 공개 홈 전용: staff=관리자·운영자(소개 화면), member=회원 로그인(쇼핑몰)
   */
  authMode?: "staff" | "member" | "none";
}

export default function ShopSiteHeader({
  title,
  leftAction,
  rightAction,
  variant = "public",
  showAuthButton = true,
  authMode = "member",
}: ShopSiteHeaderProps) {
  const { assets } = useUserAssets();

  const defaultAuth =
    !showAuthButton || authMode === "none" ? (
      <div className="w-14" />
    ) : variant === "member" ? (
      <ShopAuthButton variant="member" />
    ) : authMode === "staff" ? (
      <StaffAuthLinks />
    ) : (
      <ShopAuthButton variant="public" />
    );

  const rightSlot = rightAction ?? defaultAuth;

  return (
    <div
      data-testid="shop-site-header"
      className="flex-shrink-0 sticky top-0 z-[65] bg-[#111111] border-b border-[#333]"
    >
      <div className="h-12 flex items-center gap-2 px-4">
        <div className="flex items-center gap-1 flex-shrink-0">
          {leftAction}
          <button
            type="button"
            onClick={() => navigateToGame()}
            data-testid="button-shop-logo"
            aria-label="게임으로 돌아가기"
            className="flex-shrink-0 p-0.5"
          >
            <img
              src={assets.headerLogo}
              alt="PPAMONG"
              className="h-9 w-auto max-w-[72px] object-contain"
            />
          </button>
        </div>

        <div className="flex-1 min-w-0 flex justify-center px-1">
          {title && (
            <p
              data-testid="shop-site-title"
              className="text-white text-sm font-medium truncate text-center w-full"
            >
              {title}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">{rightSlot}</div>
      </div>
    </div>
  );
}
