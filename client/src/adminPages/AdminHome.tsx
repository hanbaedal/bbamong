import { useMemo } from "react";
import AdminLayout from "./adminLayout";
import { useUser } from "@/contexts/UserContext";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useLocation } from "wouter";
import {
  buildAdminMenuSections,
  flattenSectionLinks,
} from "./adminMenuConfig";

export default function AdminHomePage() {
  const { user } = useUser();
  const { assets } = useAdminAssets();
  const [, setLocation] = useLocation();
  const isSuperAdmin = user?.userType === "슈퍼어드민";

  const sections = useMemo(
    () => buildAdminMenuSections(isSuperAdmin),
    [isSuperAdmin],
  );

  const dashboardSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          links: flattenSectionLinks(section),
        }))
        .filter((section) => section.links.length > 0),
    [sections],
  );

  return (
    <AdminLayout>
      <div className="flex flex-col h-full max-w-4xl">
        <h1
          className="text-xl md:text-2xl font-semibold text-[#201E22] mb-2 flex items-center gap-2"
          data-testid="text-page-title"
        >
          <img src={assets.adListIcon} className="w-8 h-8" alt="" />
          관리자 대시보드
        </h1>
        <p className="text-sm text-[#666] mb-6 md:mb-8">
          {user?.name ?? "관리자"}님, PPAMONG 관리자 페이지에 오신 것을 환영합니다.
          {isSuperAdmin ? " (슈퍼바이저)" : ""}
        </p>

        <button
          type="button"
          onClick={() => setLocation("/admin/homepage-management")}
          className="mb-4 w-full text-left p-4 rounded-lg border border-[#E0E0E0] bg-white hover:border-[#E11936] transition"
        >
          <span className="text-sm font-medium text-[#201E22]">홈페이지 관리 · 상품 등록</span>
          <p className="text-xs text-[#888] mt-1">굿즈 상품·구매 링크·문의 이메일 설정</p>
        </button>

        <button
          type="button"
          onClick={() => setLocation("/admin/homepage-shop")}
          className="mb-6 w-full text-left p-5 rounded-xl border-2 border-[#E11936] bg-gradient-to-r from-[#FFF9FA] to-white hover:from-[#FFF0F2] transition shadow-sm"
        >
          <p className="text-base font-bold text-[#E11936] mb-1">홈페이지 쇼핑몰</p>
          <p className="text-sm text-[#666]">
            회사소개 동영상 재생 후 카테고리 아이콘 쇼핑몰 화면으로 이동합니다.
          </p>
        </button>

        <div className="flex flex-col gap-6">
          {dashboardSections.map((section, index) => (
            <section key={section.id}>
              {index > 0 && (
                <div
                  className="mb-6 h-px bg-[#D1D5DB] w-full"
                  role="separator"
                  aria-hidden="true"
                />
              )}
              {section.title && (
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[#888] mb-3">
                  {section.title}
                </h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {section.links.map((link) => (
                  <button
                    key={link.path}
                    type="button"
                    onClick={() => setLocation(link.path)}
                    className="text-left p-4 rounded-lg border border-[#E0E0E0] bg-white hover:border-[#E11936] hover:bg-[#FFF9FA] transition shadow-sm"
                  >
                    <span className="text-sm font-medium text-[#201E22]">{link.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
