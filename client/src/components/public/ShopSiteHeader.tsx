import type { ReactNode } from "react";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { navigateToGame } from "@/lib/appNavigation";
import ShopAuthButton from "@/components/public/ShopAuthButton";

interface ShopSiteHeaderProps {
  title?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  /** public: 공개 홈페이지, member: 회원 앱 쇼핑몰 */
  variant?: "public" | "member";
  showAuthButton?: boolean;
}

export default function ShopSiteHeader({
  title,
  leftAction,
  rightAction,
  variant = "public",
  showAuthButton = true,
}: ShopSiteHeaderProps) {
  const { assets } = useUserAssets();

  const rightSlot =
    rightAction ??
    (showAuthButton ? <ShopAuthButton variant={variant} /> : <div className="w-14" />);

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
