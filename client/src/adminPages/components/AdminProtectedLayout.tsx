import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@/contexts/UserContext";

const ADMIN_TYPES = new Set(["슈퍼어드민", "일반어드민"]);
const PUBLIC_PATHS = new Set(["/admin/login", "/admin/signup", "/admin/waiting"]);

export function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoaded } = useUser();
  const [, setLocation] = useLocation();
  const path = window.location.pathname;

  useEffect(() => {
    if (!isUserLoaded || PUBLIC_PATHS.has(path)) return;

    if (!user) {
      setLocation("/admin/login");
      return;
    }

    if (user.userType && !ADMIN_TYPES.has(user.userType)) {
      setLocation("/admin/login");
    }
  }, [user, isUserLoaded, path, setLocation]);

  if (!isUserLoaded && !PUBLIC_PATHS.has(path)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#E11936] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
