import { useState } from "react";
import { useLocation } from "wouter";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFullUrl } from "@/lib/queryClient";
import { useAdminAssets } from "@/contexts/AdminAssetContext";

interface AdminHeaderProps {
  onOpenMenu?: () => void;
}

export default function AdminHeader({ onOpenMenu }: AdminHeaderProps) {
  const [, setLocation] = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { assets } = useAdminAssets();

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await fetch(getFullUrl("/api/admin/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
      setLocation("/admin/login");
    }
  };

  return (
    <div
      className="h-14 sm:h-[6vh] sm:min-h-[60px] sm:max-h-[90px] bg-white border-b border-[#E9E9E9] flex items-center justify-between px-3 sm:px-4 md:px-8 shrink-0"
      data-testid="admin-header"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0 text-[#201E22]"
          onClick={onOpenMenu}
          aria-label="메뉴 열기"
          data-testid="button-admin-menu"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <button
          type="button"
          onClick={() => setLocation("/admin/home")}
          className="flex items-center gap-2 min-w-0"
          aria-label="관리자 홈"
        >
          <img
            src={assets.adminLogo}
            alt="PPAMONG Admin"
            className="h-9 sm:h-10 w-auto object-contain shrink-0"
            data-testid="img-admin-header-logo"
          />
          <span
            className="text-base sm:text-lg md:text-xl font-bold text-[#201E22] truncate hidden sm:inline"
            data-testid="text-logo"
          >
            PPAMONG Admin
          </span>
        </button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="text-gray-600 hover:text-gray-900 shrink-0"
        data-testid="button-admin-logout"
      >
        <LogOut className="w-4 h-4 sm:mr-2" />
        <span className="hidden sm:inline">{isLoggingOut ? "로그아웃 중..." : "로그아웃"}</span>
      </Button>
    </div>
  );
}
