import { useMemo } from "react";
import AdminLayout from "./adminLayout";
import { useUser } from "@/contexts/UserContext";
import { useLocation } from "wouter";
import { buildAdminSitemapColumns, countSitemapLinks } from "./adminMenuConfig";
import AdminSitemapColumn from "./components/AdminSitemapColumn";

export default function AdminHomePage() {
  const { user } = useUser();
  const [location, setLocation] = useLocation();
  const isSuperAdmin = user?.userType === "슈퍼어드민";

  const columns = useMemo(() => buildAdminSitemapColumns(isSuperAdmin), [isSuperAdmin]);

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0 w-full max-w-none -mx-1 sm:-mx-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-2 shrink-0">
          <h1 className="text-base lg:text-lg font-semibold text-[#201E22]" data-testid="text-page-title">
            사이트맵
          </h1>
          <p className="text-[11px] lg:text-xs text-[#888]">
            {user?.name ?? "관리자"}님
            {isSuperAdmin ? " · 슈퍼바이저" : ""}
            · 운영자 모니터링 제외
          </p>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 lg:gap-2.5 items-start flex-1 min-h-0 content-start"
          data-testid="admin-sitemap-grid"
        >
          {columns.map((column) => (
            <AdminSitemapColumn
              key={column.id}
              columnId={column.id}
              label={column.label}
              items={column.items}
              linkCount={countSitemapLinks(column.items)}
              currentPath={location}
              onNavigate={setLocation}
            />
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
