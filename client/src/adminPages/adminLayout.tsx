import { ReactNode } from "react";
import AdminHeader from "./components/AdminHeader";
import AdminSidebar from "./components/AdminSidebar";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-white w-full">
      {/* 헤더 (상단 고정) */}
      <AdminHeader />

      {/* 헤더 아래: 사이드바 + 콘텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 사이드바 (왼쪽) */}
        <AdminSidebar />

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 bg-white flex flex-col overflow-auto min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
