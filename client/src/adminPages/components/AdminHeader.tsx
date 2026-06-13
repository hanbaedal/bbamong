import { useState } from "react";
import { useLocation } from "wouter";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFullUrl } from "@/lib/queryClient";

export default function AdminHeader() {
  const [, setLocation] = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
      className="h-[6vh] min-h-[60px] max-h-[90px] bg-white border-b border-[#E9E9E9] flex items-center justify-between px-4 md:px-8"
      data-testid="admin-header"
    >
      <h1 className="text-lg md:text-2xl font-bold text-[#201E22]" data-testid="text-logo">
        PPADUN NINE
      </h1>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="text-gray-600 hover:text-gray-900"
        data-testid="button-admin-logout"
      >
        <LogOut className="w-4 h-4 mr-2" />
        {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
      </Button>
    </div>
  );
}
