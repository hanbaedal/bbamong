import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import AdminLayout from "../adminLayout";
import { apiRequest, queryClient, adminFetch } from "@/lib/adminQueryClient";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useUser } from "@/contexts/UserContext";
import { useLocation } from "wouter";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";

interface LoginStatusRow {
  id: string;
  username: string;
  name: string;
  status: "온라인" | "오프라인";
  lastLogin: string | null;
  lastLogout: string | null;
  sessionDuration: string;
}

interface LoginStatusResponse {
  rows: LoginStatusRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function formatDateTime(date: string | null) {
  if (!date) return "--";
  const d = new Date(date);
  return `${format(d, "yyyy.MM.dd", { locale: ko })}\n${format(d, "aa h:mm:ss", { locale: ko })}`;
}

export default function ManagerLoginStatusPage() {
  const { user, isUserLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { assets } = useAdminAssets();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useResponsivePageSize();
  const isSuperAdmin = user?.userType === "슈퍼어드민";

  useEffect(() => {
    if (isUserLoaded && !isSuperAdmin) setLocation("/admin/members/list");
  }, [isUserLoaded, isSuperAdmin, setLocation]);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  const { data, isLoading } = useQuery<LoginStatusResponse>({
    queryKey: ["/api/admin/ops/manager-login-status", currentPage, itemsPerPage],
    queryFn: async () => {
      const res = await adminFetch(
        `/api/admin/ops/manager-login-status?page=${currentPage}&limit=${itemsPerPage}`,
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

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 mb-3 md:mb-4 shrink-0">
          <span className="text-xs md:text-sm text-[#BFBFBF]">업무관리</span>
          <span className="text-xs md:text-sm text-[#BFBFBF]">&gt;</span>
          <span className="text-xs md:text-sm text-[#201E22]">운영자 로그인 현황</span>
        </div>

        <h1 className="text-lg md:text-xl font-semibold text-[#201E22] mb-4 flex items-center gap-2">
          <img src={assets.adMangerListIcon} className="w-8 h-8" alt="" />
          운영자 로그인 현황
        </h1>

        <div className="grid grid-cols-[14%_14%_12%_18%_18%_14%_10%] min-w-[720px] px-4 py-3 bg-[#F9F9F9] text-xs md:text-sm font-medium text-[#4D4B4E] shrink-0">
          <div>운영자 ID</div>
          <div>이름</div>
          <div>상태</div>
          <div>마지막 로그인</div>
          <div>마지막 로그아웃</div>
          <div>세션 시간</div>
          <div>관리</div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="p-8 text-center text-[#BFBFBF]">불러오는 중...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-[#BFBFBF]">운영자가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[14%_14%_12%_18%_18%_14%_10%] min-w-[720px] px-4 py-4 border-b text-xs md:text-sm items-center"
                >
                  <div className="truncate">{row.username}</div>
                  <div className="truncate">{row.name}</div>
                  <div className={row.status === "온라인" ? "text-[#4285F4]" : "text-[#888]"}>
                    {row.status}
                  </div>
                  <div className="whitespace-pre-line">{formatDateTime(row.lastLogin)}</div>
                  <div className="whitespace-pre-line">{formatDateTime(row.lastLogout)}</div>
                  <div>{row.sessionDuration}</div>
                  <div>
                    {row.status === "온라인" && (
                      <button
                        type="button"
                        onClick={() => forceLogoutMutation.mutate(row.id)}
                        className="px-2 py-1 text-xs text-white bg-[#E11936] rounded hover:bg-[#C71530]"
                      >
                        세션 종료
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <AdminPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </AdminLayout>
  );
}
