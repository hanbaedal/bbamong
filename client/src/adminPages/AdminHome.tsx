import AdminLayout from "./adminLayout";
import { useUser } from "@/contexts/UserContext";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useLocation } from "wouter";

const quickLinks = [
  { label: "홈페이지 관리", path: "/admin/homepage-management", roles: ["all"] },
  { label: "회원 리스트", path: "/admin/members/list", roles: ["all"] },
  { label: "경기 관리", path: "/admin/match-management", roles: ["all"] },
  { label: "공지사항", path: "/admin/notices", roles: ["all"] },
  { label: "관리자 리스트", path: "/admin/staff/list", roles: ["super"] },
  { label: "관리자 등록", path: "/admin/staff/register", roles: ["super"] },
  { label: "운영자 리스트", path: "/admin/operators/list", roles: ["all"] },
] as const;

export default function AdminHomePage() {
  const { user } = useUser();
  const { assets } = useAdminAssets();
  const [, setLocation] = useLocation();
  const isSuperAdmin = user?.userType === "슈퍼어드민";

  const links = quickLinks.filter(
    (link) => link.roles[0] === "all" || (link.roles[0] === "super" && isSuperAdmin),
  );

  return (
    <AdminLayout>
      <div className="flex flex-col h-full">
        <h1
          className="text-xl md:text-2xl font-semibold text-[#201E22] mb-2 flex items-center gap-2"
          data-testid="text-page-title"
        >
          <img src={assets.adListIcon} className="w-8 h-8" alt="" />
          홈 페이지
        </h1>
        <p className="text-sm text-[#666] mb-8">
          {user?.name ?? "관리자"}님, PPAMONG 관리자 페이지에 오신 것을 환영합니다.
          {isSuperAdmin ? " (슈퍼바이저)" : ""}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl">
          {links.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => setLocation(link.path)}
              className="text-left p-4 rounded-lg border border-[#E9E9E9] hover:border-[#E11936] hover:bg-[#FFF9FA] transition"
            >
              <span className="text-sm font-medium text-[#201E22]">{link.label}</span>
            </button>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
