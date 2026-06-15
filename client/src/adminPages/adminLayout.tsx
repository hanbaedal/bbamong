import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import AdminHeader from "./components/AdminHeader";
import AdminSidebar from "./components/AdminSidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location]);

  return (
    <div className="flex flex-col h-[100dvh] bg-white w-full">
      <AdminHeader onOpenMenu={() => setMobileNavOpen(true)} />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* PC: 고정 사이드바 */}
        <div className="hidden lg:block shrink-0 h-full">
          <AdminSidebar />
        </div>

        {/* 모바일/태블릿: 드로어 메뉴 */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            side="left"
            className="p-0 w-[min(280px,85vw)] max-w-[85vw] border-r border-[#E9E9E9]"
          >
            <AdminSidebar onNavigate={() => setMobileNavOpen(false)} className="w-full border-r-0" />
          </SheetContent>
        </Sheet>

        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 bg-white flex flex-col overflow-auto min-h-0 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
