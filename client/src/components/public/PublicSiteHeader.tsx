import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { useUserAssets } from "@/contexts/UserAssetContext";

interface PublicSiteHeaderProps {
  title?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}

export default function PublicSiteHeader({
  title,
  leftAction,
  rightAction,
}: PublicSiteHeaderProps) {
  const [, setLocation] = useLocation();
  const { assets } = useUserAssets();

  const defaultRight = (
    <button
      type="button"
      onClick={() => setLocation("/admin/login")}
      data-testid="button-admin-login"
      className="text-[#CDFF00] text-xs font-semibold whitespace-nowrap px-2 py-1 rounded border border-[#CDFF00]/40 hover:bg-[#CDFF00]/10 focus:outline-none"
    >
      로그인
    </button>
  );

  return (
    <div
      data-testid="public-site-header"
      className="flex-shrink-0 sticky top-0 z-[65] bg-[#111111] border-b border-[#333]"
    >
      <div className="h-12 flex items-center justify-between gap-3 px-4">
        {leftAction ?? <div className="w-10 flex-shrink-0" />}

        <button
          type="button"
          onClick={() => setLocation("/")}
          data-testid="button-public-logo"
          className="flex-1 flex justify-center min-w-0"
        >
          <img
            src={assets.headerLogo}
            alt="PPAMONG"
            className="h-9 w-auto max-w-[72px] object-contain"
          />
        </button>

        <div className="flex-shrink-0 flex justify-end min-w-[52px]">
          {rightAction ?? defaultRight}
        </div>
      </div>
      {title && (
        <p className="text-center text-white text-sm font-medium pb-2 px-4 truncate">
          {title}
        </p>
      )}
    </div>
  );
}
