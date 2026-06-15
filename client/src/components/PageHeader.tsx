import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { useLocation } from "wouter";
import { useUserAssets } from "@/contexts/UserAssetContext";

interface PageHeaderProps {
  title?: string;
  onTitleClick?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  showSettings?: boolean;
  borderBottom?: boolean;
}

export default function PageHeader({
  title,
  onTitleClick,
  leftAction,
  rightAction,
  showSettings = true,
  borderBottom = false,
}: PageHeaderProps) {
  const [, setLocation] = useLocation();
  const { assets } = useUserAssets();

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
          onClick={() => setLocation("/home")}
          data-testid="button-header-logo"
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
            onClick={() => setLocation("/settings")}
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
