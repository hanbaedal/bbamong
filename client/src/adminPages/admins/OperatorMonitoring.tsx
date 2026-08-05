import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/adminQueryClient";
import AdminLayout from "../adminLayout";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";
import { OpsPlatformTabs, type OpsPlatform } from "../ops/opsLoginStatusUi";

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

export default function OperatorMonitoringPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [platform, setPlatform] = useState<OpsPlatform>("ppamong");
  const itemsPerPage = useResponsivePageSize();

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, platform]);

  const { assets } = useAdminAssets();
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

  const formatDateTime = (date: Date | null) => {
    if (!date) return "--";

    const d = new Date(date);
    const datePart = format(d, "yyyy.MM.dd", { locale: ko });
    const timePart = format(d, "aa h:mm:ss", { locale: ko });

    return `${datePart}\n${timePart}`;
  };

  function SkeletonRow() {
    return (
      <div className="grid grid-cols-[10%_12%_14%_14%_14%_14%_22%] min-w-[980px] px-2 md:px-4 py-2 md:py-5 bg-white border-b border-[#E9E9E9] items-center h-16">
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-10 md:w-16 animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-8 md:w-12 animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-20 md:w-32 animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-20 md:w-32 animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-20 md:w-32 animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-16 md:w-24 animate-pulse" />
        <div className="h-5 md:h-6 bg-[#E9E9E9] rounded w-16 md:w-24 animate-pulse" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 mb-3 md:mb-4 lg:mb-6" data-testid="breadcrumb">
          <span className="text-xs md:text-sm text-[#BFBFBF]">운영자 관리</span>
          <span className="text-xs md:text-sm text-[#BFBFBF]">&gt;</span>
          <span className="text-xs md:text-sm text-[#201E22]">운영자 상태 모니터링</span>
        </div>

        <h1
          className="text-lg md:text-xl lg:text-2xl font-semibold text-[#201E22] mb-3 md:mb-4 lg:mb-6 flex items-center gap-2"
          data-testid="text-page-title"
        >
          <img src={assets.adListIcon} className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" alt="icon" />{" "}
          운영자 상태 모니터링
        </h1>

        <OpsPlatformTabs
          platform={platform}
          counts={counts}
          onChange={setPlatform}
          ppamongSublabel="op1~op5 현장 운영자"
          badminton9Sublabel="레거시 매니저"
        />

        <div className="overflow-x-auto flex-1 min-h-0 flex flex-col">
          <div className="grid grid-cols-[10%_12%_14%_14%_14%_14%_22%] min-w-[980px] px-2 md:px-4 py-2 md:py-3 bg-[#F3F0FF] text-xs md:text-sm font-medium text-[#6B5B95] mb-2 flex-shrink-0">
            <div>운영자 명칭</div>
            <div>로그인 상태</div>
            <div>로그인 지역</div>
            <div>마지막 로그인</div>
            <div>마지막 로그아웃</div>
            <div>세션 지속 시간</div>
            <div>관리</div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="space-y-0">
                {Array.from({ length: itemsPerPage }).map((_, index) => (
                  <SkeletonRow key={index} />
                ))}
              </div>
            ) : operators.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 md:py-24 lg:py-32">
                <p className="text-sm md:text-base text-[#BFBFBF]">
                  {platform === "ppamong"
                    ? "빠몽 운영자가 없습니다."
                    : "빠던9 레거시 운영자가 없습니다."}
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {operators.map((operator, index) => (
                  <div
                    key={operator.id}
                    className={`grid grid-cols-[10%_12%_14%_14%_14%_14%_22%] min-w-[980px] px-2 md:px-4 border-b border-[#EDE9F6]/80 text-xs md:text-sm text-[#201E22] items-center h-16 ${
                      operator.platform === "ppamong" ? "bg-[#FFF5F8]" : "bg-[#F0F7FF]"
                    }`}
                    data-testid={`operator-row-${index}`}
                  >
                    <div className="truncate" title={operator.username}>
                      <span className="font-semibold">{operator.username}</span>
                      {operator.name && operator.name !== operator.username && (
                        <span className="block text-[10px] text-[#888] truncate">{operator.name}</span>
                      )}
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center justify-center w-2 h-2 rounded-full mr-2 ${
                          operator.status === "온라인" ? "bg-[#92E945]" : "bg-[#E75C5D]"
                        }`}
                      />
                      <span className="text-sm">{operator.status}</span>
                    </div>
                    <div className="text-sm truncate" title={operator.lastLoginRegion || undefined}>
                      {operator.lastLoginRegion || "--"}
                    </div>
                    <div className="text-sm whitespace-pre-line">
                      {formatDateTime(operator.lastLogin)}
                    </div>
                    <div className="text-sm whitespace-pre-line">
                      {formatDateTime(operator.lastLogout)}
                    </div>
                    <div className="text-sm">{operator.sessionDuration}</div>
                    <div>
                      <button
                        onClick={() => forceLogoutMutation.mutate(operator.id)}
                        disabled={operator.status === "오프라인" || forceLogoutMutation.isPending}
                        className={`px-2 md:px-3 py-1 text-[10px] md:text-xs font-medium text-white rounded ${
                          operator.status === "오프라인" || forceLogoutMutation.isPending
                            ? "bg-[#BFBFBF] cursor-not-allowed"
                            : "bg-[#E11936] hover:bg-[#C71530]"
                        }`}
                        data-testid={`button-force-logout-${index}`}
                      >
                        강제 로그아웃
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
