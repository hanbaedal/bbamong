import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "../adminLayout";
import AdminPageShell from "../components/AdminPageShell";
import { adminTableClass, adminTableWrapClass } from "../components/adminPageStyles";
import { apiRequest, queryClient, adminFetch } from "@/lib/adminQueryClient";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useUser } from "@/contexts/UserContext";
import { useLocation } from "wouter";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";
import {
  formatOpsDateTime,
  OnlineBadge,
  OpsPlatformTabs,
  type OpsLoginStatusResponse,
  type OpsPlatform,
} from "./opsLoginStatusUi";

export default function ManagerLoginStatusPage() {
  const { user, isUserLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { assets } = useAdminAssets();
  const [currentPage, setCurrentPage] = useState(1);
  const [platform, setPlatform] = useState<OpsPlatform>("ppamong");
  const itemsPerPage = useResponsivePageSize();
  const isSuperAdmin = user?.userType === "슈퍼어드민";

  useEffect(() => {
    if (isUserLoaded && !isSuperAdmin) setLocation("/admin/members/list");
  }, [isUserLoaded, isSuperAdmin, setLocation]);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, platform]);

  const { data, isLoading } = useQuery<OpsLoginStatusResponse>({
    queryKey: ["/api/admin/ops/manager-login-status", currentPage, itemsPerPage, platform],
    queryFn: async () => {
      const res = await adminFetch(
        `/api/admin/ops/manager-login-status?page=${currentPage}&limit=${itemsPerPage}&platform=${platform}`,
      );
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
    enabled: isUserLoaded && isSuperAdmin,
  });

  const forceLogoutMutation = useMutation({
    mutationFn: async (managerId: string) =>
      apiRequest("POST", `/api/admin/ops/manager-login-status/${managerId}/force-logout`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ops/manager-login-status"] });
    },
  });

  if (!isUserLoaded || !isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full text-gray-500">로딩 중...</div>
      </AdminLayout>
    );
  }

  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;
  const counts = data?.counts ?? { ppamong: 0, badminton9: 0 };
  const onlineCount = rows.filter((r) => r.status === "온라인").length;

  return (
    <AdminLayout>
      <AdminPageShell
        title="운영자 로그인 현황"
        description="빠몽·빠던9 운영자 세션을 구분해 확인합니다."
        icon={<img src={assets.adMangerListIcon} className="w-7 h-7 lg:w-8 lg:h-8" alt="" />}
      >
        <OpsPlatformTabs
          platform={platform}
          counts={counts}
          onChange={setPlatform}
          ppamongSublabel="op1~op5 현장 운영자"
          badminton9Sublabel="레거시 매니저"
        />

        {!isLoading && rows.length > 0 && (
          <p className="text-sm text-[#666] mb-3 hidden" data-testid="page-intro">
            현재 탭{" "}
            <span className="font-semibold text-[#201E22]">
              {platform === "ppamong" ? "빠몽" : "빠던9"}
            </span>{" "}
            · 이 페이지 {rows.length}명
            {onlineCount > 0 && (
              <span className="text-[#4285F4]"> · 온라인 {onlineCount}명</span>
            )}
          </p>
        )}

        {isLoading ? (
          <div className={`${adminTableWrapClass} bg-white`}>
            <div className="p-8 text-center text-sm text-[#888]">불러오는 중...</div>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E0E0E0] bg-[#FAFAFA] p-10 text-center">
            <p className="text-sm text-[#888]">
              {platform === "ppamong"
                ? "빠몽 운영자 로그인 기록이 없습니다."
                : "빠던9 레거시 운영자가 없습니다."}
            </p>
          </div>
        ) : (
          <div className={adminTableWrapClass}>
            <table className={adminTableClass}>
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E9E9E9] text-left text-xs text-[#888]">
                  <th className="px-4 py-3 font-medium">운영자</th>
                  <th className="px-4 py-3 font-medium">배정 경기</th>
                  <th className="px-4 py-3 font-medium w-24 text-center">상태</th>
                  <th className="px-4 py-3 font-medium">마지막 로그인</th>
                  <th className="px-4 py-3 font-medium">마지막 로그아웃</th>
                  <th className="px-4 py-3 font-medium">세션 시간</th>
                  <th className="px-4 py-3 font-medium w-24 text-center">관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#F0F0F0] bg-white hover:bg-[#FFFBFB] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#201E22]">{row.name}</p>
                      <p className="text-xs font-mono text-[#888] mt-0.5">{row.username}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#444]">
                      {row.assignedMatchNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <OnlineBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[#444] whitespace-nowrap tabular-nums">
                      {formatOpsDateTime(row.lastLogin)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#444] whitespace-nowrap tabular-nums">
                      {formatOpsDateTime(row.lastLogout)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#444] tabular-nums">
                      {row.sessionDuration}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.status === "온라인" ? (
                        <button
                          type="button"
                          onClick={() => forceLogoutMutation.mutate(row.id)}
                          disabled={forceLogoutMutation.isPending}
                          className="px-2.5 py-1 text-xs font-medium text-[#E11936] border border-[#E11936]/30 rounded hover:bg-[#FFF5F6] disabled:opacity-50"
                        >
                          세션 종료
                        </button>
                      ) : (
                        <span className="text-xs text-[#CCC]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4">
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </AdminPageShell>
    </AdminLayout>
  );
}
