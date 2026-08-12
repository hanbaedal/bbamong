import type { ReactNode } from "react";
import { Settings, Gift } from "lucide-react";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { isHomepageShopPath, navigateToHome, navigateToMall } from "@/lib/appNavigation";
import { useLocation } from "wouter";

interface PageHeaderProps {
  title?: string;
  onTitleClick?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  showSettings?: boolean;
  /** 헤더 우측 「쇼핑몰」 버튼 (기본 true). 로고는 홈(게임 설명)으로 이동 */
  showMallButton?: boolean;
  borderBottom?: boolean;
  /** @deprecated 로고는 항상 홈으로 이동. 호환용으로만 유지 */
  logoDestination?: "auto" | "game" | "homepage";
}

export default function PageHeader({
  title,
  onTitleClick,
  leftAction,
  rightAction,
  showSettings = false,
  showMallButton = true,
  borderBottom = false,
}: PageHeaderProps) {
  const [location] = useLocation();
  const { assets } = useUserAssets();
  const onMall = isHomepageShopPath(location);

  return (
    <div
      data-testid="page-header"
      className={`flex-shrink-0 sticky top-0 z-[65] bg-[#111111] ${borderBottom ? "border-b border-[#373539]" : ""}`}
    >
      <div className="h-[48px] flex items-center justify-between gap-3 px-5 relative">
        {leftAction ? (
          leftAction
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            {title &&
              (onTitleClick ? (
                <button
                  onClick={onTitleClick}
                  data-testid="button-header-title"
                  className="focus:outline-none"
                >
                  <h1 className="text-white text-[20px] font-bold max-w-[120px] truncate">
                    {title}
                  </h1>
                </button>
              ) : (
                <h1 className="text-white text-[20px] font-bold max-w-[120px] truncate">
                  {title}
                </h1>
              ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => navigateToHome()}
          data-testid="button-header-logo"
          aria-label="PPAMONG 홈으로 이동"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <img
            src={assets.headerLogo}
            alt="PPAMONG"
            className="h-11 w-auto max-w-[72px] object-contain"
          />
        </button>

        <div className="flex items-center gap-1 ml-auto">
          {showMallButton && !onMall && (
            <button
              type="button"
              onClick={() => navigateToMall()}
              data-testid="button-header-mall"
              aria-label="쇼핑센터"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[#CDFF00] hover:bg-white/5 focus:outline-none focus-visible:outline-none"
            >
              <Gift className="w-5 h-5 text-[#DC143C]" strokeWidth={2} />
              <span className="text-xs font-semibold whitespace-nowrap">쇼핑센터</span>
            </button>
          )}
          {rightAction ? (
            rightAction
          ) : showSettings ? (
            <button
              onClick={() => window.location.assign("/settings")}
              data-testid="button-settings"
              className="p-1 focus:outline-none focus-visible:outline-none"
            >
              <Settings className="w-6 h-6" style={{ color: "#959595" }} />
            </button>
          ) : (
            <div className="w-6" />
          )}
        </div>
      </div>
    </div>
  );
}
