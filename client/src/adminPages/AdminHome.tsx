import { useMemo } from "react";
import AdminLayout from "./adminLayout";
import { useUser } from "@/contexts/UserContext";
import { useLocation } from "wouter";
import { buildAdminSitemapColumns } from "./adminMenuConfig";
import AdminSitemapColumn from "./components/AdminSitemapColumn";

export default function AdminHomePage() {
  const { user } = useUser();
  const [location, setLocation] = useLocation();
  const isSuperAdmin = user?.userType === "슈퍼어드민";

  const columns = useMemo(() => buildAdminSitemapColumns(isSuperAdmin), [isSuperAdmin]);

  return (
    <AdminLayout>
      <div className="flex flex-col h-full w-full max-w-none">
        <h1
          className="text-xl lg:text-2xl font-semibold text-[#201E22] mb-1"
          data-testid="text-page-title"
        >
          사이트맵
        </h1>
        <p className="text-sm text-[#666] mb-5 lg:mb-6">
          {user?.name ?? "관리자"}님 · 관리 메뉴 전체 (운영자 모니터링 제외)
          {isSuperAdmin ? " · 슈퍼바이저" : ""}
        </p>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-x-4 gap-y-6 xl:gap-x-5"
          data-testid="admin-sitemap-grid"
        >
          {columns.map((column) => (
            <AdminSitemapColumn
              key={column.id}
              label={column.label}
              items={column.items}
              currentPath={location}
              onNavigate={setLocation}
            />
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
