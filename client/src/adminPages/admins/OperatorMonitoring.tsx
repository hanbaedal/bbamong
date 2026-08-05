import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/adminQueryClient";
import AdminLayout from "../adminLayout";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";
import type { OpsPlatform } from "../ops/opsLoginStatusUi";
import {
  AdminCompactListPage,
  AdminCompactTable,
  AdminCompactTableShell,
  adminCompactTdClass,
  adminCompactThClass,
  adminCompactTheadRowClass,
  adminCompactTrClass,
} from "../components/adminCompactListUi";
import { cn } from "@/lib/utils";

interface OperatorStatus {
  id: string;
  username: string;
  name: string;
  status: "온라인" | "오프라인";
  lastLogin: Date | null;
  lastLogout: Date | null;
  lastLoginRegion: string;
  sessionDuration: string;
  platform: OpsPlatform;
}

interface OperatorListResponse {
  operators: OperatorStatus[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  platform: OpsPlatform;
  counts: { ppamong: number; badminton9: number };
}

function formatDateTime(date: Date | null) {
  if (!date) return "—";
  const d = new Date(date);
  return `${format(d, "yyyy.MM.dd", { locale: ko })} ${format(d, "HH:mm:ss", { locale: ko })}`;
}

export default function OperatorMonitoringPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [platform, setPlatform] = useState<OpsPlatform>("ppamong");
  const itemsPerPage = useResponsivePageSize();

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, platform]);

  const queryKey = `/api/admin/operator-monitoring?page=${currentPage}&limit=${itemsPerPage}&platform=${platform}`;

  const { data, isLoading } = useQuery<OperatorListResponse>({
    queryKey: [queryKey],
  });

  const operators = data?.operators || [];
  const totalPages = data?.totalPages || 1;
  const counts = data?.counts ?? { ppamong: 0, badminton9: 0 };

  const forceLogoutMutation = useMutation({
    mutationFn: async (operatorId: string) => {
      return await apiRequest(
        "POST",
        `/api/admin/operator-monitoring/${operatorId}/force-logout`,
        {},
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/admin/operator-monitoring"),
      });
    },
  });

  return (
    <AdminLayout>
      <AdminCompactListPage
        title="운영자 상태 모니터링"
        platformTabs={{
          platform,
          counts,
          onChange: setPlatform,
          ppamongSublabel: "op1~op5 현장 운영자",
          badminton9Sublabel: "레거시 매니저",
          countLabel: "명",
        }}
        footer={
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        }
      >
        <AdminCompactTableShell
          minWidth={880}
          isLoading={isLoading}
          loadingCols={7}
          emptyMessage={
            operators.length === 0
              ? platform === "ppamong"
                ? "빠몽 운영자가 없습니다."
                : "빠던9 레거시 운영자가 없습니다."
              : undefined
          }
        >
          {operators.length > 0 ? (
            <AdminCompactTable minWidth={880}>
              <thead>
                <tr className={adminCompactTheadRowClass}>
                  <th className={adminCompactThClass}>운영자</th>
                  <th className={adminCompactThClass}>상태</th>
                  <th className={adminCompactThClass}>로그인 지역</th>
                  <th className={adminCompactThClass}>마지막 로그인</th>
                  <th className={adminCompactThClass}>마지막 로그아웃</th>
                  <th className={adminCompactThClass}>세션</th>
                  <th className={`${adminCompactThClass} w-24`}>관리</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((operator, index) => (
                  <tr
                    key={operator.id}
                    className={cn(
                      adminCompactTrClass,
                      operator.platform === "ppamong" ? "bg-[#FFF5F8]" : "bg-[#F0F7FF]",
                    )}
                    data-testid={`operator-row-${index}`}
                  >
                    <td className={adminCompactTdClass}>
                      <span className="font-semibold">{operator.username}</span>
                      {operator.name && operator.name !== operator.username && (
                        <span className="block text-[10px] text-[#888] truncate">{operator.name}</span>
                      )}
                    </td>
                    <td className={adminCompactTdClass}>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[11px]",
                          operator.status === "온라인" ? "text-[#2E7D32]" : "text-[#888]",
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            operator.status === "온라인" ? "bg-[#92E945]" : "bg-[#E75C5D]",
                          )}
                        />
                        {operator.status}
                      </span>
                    </td>
                    <td className={`${adminCompactTdClass} truncate max-w-[100px]`} title={operator.lastLoginRegion || undefined}>
                      {operator.lastLoginRegion || "—"}
                    </td>
                    <td className={`${adminCompactTdClass} tabular-nums whitespace-nowrap text-[11px]`}>
                      {formatDateTime(operator.lastLogin)}
                    </td>
                    <td className={`${adminCompactTdClass} tabular-nums whitespace-nowrap text-[11px]`}>
                      {formatDateTime(operator.lastLogout)}
                    </td>
                    <td className={`${adminCompactTdClass} whitespace-nowrap text-[11px]`}>
                      {operator.sessionDuration}
                    </td>
                    <td className={adminCompactTdClass}>
                      <button
                        type="button"
                        onClick={() => forceLogoutMutation.mutate(operator.id)}
                        disabled={operator.status === "오프라인" || forceLogoutMutation.isPending}
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-medium text-white rounded whitespace-nowrap",
                          operator.status === "오프라인" || forceLogoutMutation.isPending
                            ? "bg-[#BFBFBF] cursor-not-allowed"
                            : "bg-[#E11936] hover:bg-[#C71530]",
                        )}
                        data-testid={`button-force-logout-${index}`}
                      >
                        강제 로그아웃
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminCompactTable>
          ) : null}
        </AdminCompactTableShell>
      </AdminCompactListPage>
    </AdminLayout>
  );
}
