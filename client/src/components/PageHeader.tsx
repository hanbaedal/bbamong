import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { useLocation } from "wouter";
import { useUserAssets } from "@/contexts/UserAssetContext";
import {
  GAME_PATH,
  isHomepageShopPath,
  navigateToGame,
  navigateToHomepage,
} from "@/lib/appNavigation";

interface PageHeaderProps {
  title?: string;
  onTitleClick?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  showSettings?: boolean;
  borderBottom?: boolean;
  /** auto: 경로에 따라 게임↔홈페이지, homepage: 홈페이지, game: 게임 */
  logoDestination?: "auto" | "game" | "homepage";
}

export default function PageHeader({
  title,
  onTitleClick,
  leftAction,
  rightAction,
  showSettings = true,
  borderBottom = false,
  logoDestination = "auto",
}: PageHeaderProps) {
  const [location] = useLocation();
  const { assets } = useUserAssets();

  const resolveLogoDestination = (): "game" | "homepage" => {
    if (logoDestination === "game") return "game";
    if (logoDestination === "homepage") return "homepage";
    if (isHomepageShopPath(location)) return "game";
    if (location.split("?")[0] === GAME_PATH) return "homepage";
    return "game";
  };

  const handleLogoClick = () => {
    if (resolveLogoDestination() === "homepage") {
      navigateToHomepage();
      return;
    }
    navigateToGame();
  };

  return (
    <div
      data-testid="page-header"
      className={`flex-shrink-0 sticky top-0 z-[65] bg-[#111111] ${borderBottom ? "border-b border-[#373539]" : ""}`}
    >
      <div className="h-[48px] flex items-center justify-between gap-3 px-5 relative">
        {leftAction ? (
          leftAction
        ) : (
          <div className="flex items-center gap-2">
            {title && (
              onTitleClick ? (
                <button onClick={onTitleClick} data-testid="button-header-title" className="focus:outline-none">
                  <h1 className="text-white text-[20px] font-bold max-w-[120px] truncate">{title}</h1>
                </button>
              ) : (
                <h1 className="text-white text-[20px] font-bold max-w-[120px] truncate">{title}</h1>
              )
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleLogoClick}
          data-testid="button-header-logo"
          aria-label="PPAMONG"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <img
            src={assets.headerLogo}
            alt="PPAMONG"
            className="h-11 w-auto max-w-[72px] object-contain"
          />
        </button>

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
  );
}
