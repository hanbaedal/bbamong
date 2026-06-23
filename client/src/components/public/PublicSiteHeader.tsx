import type { ReactNode } from "react";
import { LogIn } from "lucide-react";
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
      aria-label="관리자 로그인"
      className="p-1 focus:outline-none"
    >
      <LogIn className="w-6 h-6 text-[#959595]" />
    </button>
  );

  return (
    <div
      data-testid="public-site-header"
      className="flex-shrink-0 sticky top-0 z-[65] bg-[#111111] border-b border-[#333]"
    >
      <div className="h-12 flex items-center justify-between gap-3 px-4">
        {leftAction ?? <div className="w-8 flex-shrink-0" />}

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

        <div className="w-8 flex-shrink-0 flex justify-end">
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
