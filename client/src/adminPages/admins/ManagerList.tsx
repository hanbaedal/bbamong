import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, adminFetch } from "@/lib/adminQueryClient";
import AdminLayout from "../adminLayout";
import type { AdminUser } from "@shared/schema";
import AdminSimpleConfirmPopup from "@/components/customUi/AdminSimpleConfirmPopup";
import debounce from "lodash.debounce";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";

type AdminUserWithoutPassword = Omit<AdminUser, "password">;

interface ManagerListResponse {
  data: AdminUserWithoutPassword[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pendingCount: number;
  approvedCount: number;
  username: String;
}

export default function ManagerListPage() {
  const [activeTab, setActiveTab] = useState<"대기중" | "승인">("승인");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useResponsivePageSize();
  useEffect(() => { setCurrentPage(1); }, [itemsPerPage]);
  const { assets } = useAdminAssets();
  // 검색 및 필터
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"전체" | "부서" | "직책">(
    "전체",
  );
  const [tempSearchQuery, setTempSearchQuery] = useState("");

  // 승인 확인 팝업
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [selectedManagerForApprove, setSelectedManagerForApprove] =
    useState<AdminUserWithoutPassword | null>(null);

  // 비활성화 확인 팝업
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [selectedManagerForDeactivate, setSelectedManagerForDeactivate] =
    useState<AdminUserWithoutPassword | null>(null);

  const { toast } = useToast();

  const getBackendFilterType = (filter: "전체" | "부서" | "직책"): string => {
    switch (filter) {
      case "부서":
        return "department";
      case "직책":
        return "position";
      case "전체":
      default:
        return "name";
    }
  };

  const backendFilterType = getBackendFilterType(filterType);

  const { data, isLoading, refetch } = useQuery<ManagerListResponse>({
    queryKey: [
      "/api/admin/admin-managers",
      { status: activeTab, page: currentPage, limit: itemsPerPage, search: searchQuery, filterType: backendFilterType },
    ],
    queryFn: async () => {
      const response = await adminFetch(
        `/api/admin/admin-managers?status=${activeTab}&page=${currentPage}&limit=${itemsPerPage}&search=${searchQuery}&filterType=${backendFilterType}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch manager list");
      }
      return response.json();
    },
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  });

  const managers = data?.data || [];
  const totalPages = data?.totalPages || 1;
  const pendingCount = data?.pendingCount || 0;
  const approvedCount = data?.approvedCount || 0;

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(
        "PATCH",
        `/api/admin/admin-managers/${id}/approve`,
        { approvalStatus: "승인" },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/admin-managers"],
      });
      setApproveConfirmOpen(false);
      toast({ description: "매니저가 승인되었습니다." });
    },
    onError: (err: any) => {
      setApproveConfirmOpen(false);
      toast({ variant: "destructive", description: err?.message || "승인 요청에 실패했습니다." });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(
        "DELETE",
        `/api/admin/admin-managers/${id}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/admin-managers"],
      });
      setDeactivateConfirmOpen(false);
      toast({ description: "매니저가 삭제되었습니다. 해당 계정으로 재가입이 가능합니다." });
    },
    onError: (err: any) => {
      setDeactivateConfirmOpen(false);
      toast({ variant: "destructive", description: err?.message || "매니저 삭제에 실패했습니다." });
    },
  });

  const handleTabChange = (tab: "대기중" | "승인") => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  // 디바운스 함수 생성 (500ms)
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
      }, 500),
    [],
  );

  // tempSearchQuery가 변경될 때마다 디바운스 실행
  useEffect(() => {
    debouncedSearch(tempSearchQuery);
    return () => debouncedSearch.cancel();
  }, [tempSearchQuery, debouncedSearch]);

  const handleApproveClick = (manager: AdminUserWithoutPassword) => {
    setSelectedManagerForApprove(manager);
    setApproveConfirmOpen(true);
  };

  const handleDeactivateClick = (manager: AdminUserWithoutPassword) => {
    setSelectedManagerForDeactivate(manager);
    setDeactivateConfirmOpen(true);
  };

  const handleApproveConfirm = () => {
    if (selectedManagerForApprove) {
      approveMutation.mutate(selectedManagerForApprove.id);
    }
  };

  const handleDeactivateConfirm = () => {
    if (selectedManagerForDeactivate) {
      deactivateMutation.mutate(selectedManagerForDeactivate.id);
    }
  };

  function SkeletonRow() {
    return (
      <div className="grid grid-cols-[12%_12%_18%_16%_15%_15%_12%] px-2 md:px-4 py-2 md:py-5 bg-white border-b border-[#E9E9E9] items-center h-16">
        <div className="h-3.5 bg-[#E9E9E9] rounded w-16 animate-pulse" />
        <div className="h-3.5 bg-[#E9E9E9] rounded w-12 animate-pulse" />
        <div className="h-3.5 bg-[#E9E9E9] rounded w-32 animate-pulse" />
        <div className="h-3.5 bg-[#E9E9E9] rounded w-16 animate-pulse" />
        <div className="h-3.5 bg-[#E9E9E9] rounded w-12 animate-pulse" />
        <div className="h-3.5 bg-[#E9E9E9] rounded w-24 animate-pulse" />
        <div className="h-6 bg-[#E9E9E9] rounded w-16 animate-pulse" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 mb-3 md:mb-4 lg:mb-6 shrink-0" data-testid="breadcrumb">
          <span className="text-xs md:text-sm text-[#BFBFBF]">운영자 관리</span>
          <span className="text-xs md:text-sm text-[#BFBFBF]">&gt;</span>
          <span className="text-xs md:text-sm text-[#201E22]">운영자 리스트</span>
        </div>

        <h1
          className="text-lg md:text-xl lg:text-2xl font-semibold text-[#201E22] mb-3 md:mb-4 lg:mb-6 flex items-center gap-2 shrink-0"
          data-testid="text-page-title"
        >
          <img src={assets.adListIcon} className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" alt="icon" /> 운영자 리스트
        </h1>

        {/* 탭 */}
        <div className="flex justify-between border-b border-[#E9E9E9] mb-3 md:mb-4 lg:mb-6 shrink-0">
          {/* 왼쪽 탭 */}
          <div className="flex gap-2 md:gap-4">
            <button
              onClick={() => handleTabChange("승인")}
              className={`pb-2 md:pb-3 px-4 md:px-8 text-sm md:text-base font-medium hover:border-b-2 hover:border-[#E11936] hover:text-[#E11936] ${
                activeTab === "승인"
                  ? "border-b-2 border-[#E11936] text-[#E11936]"
                  : "text-[#BFBFBF] border-transparent"
              }`}
              data-testid="tab-approved"
            >
              직원 {approvedCount}
            </button>
            <button
              onClick={() => handleTabChange("대기중")}
              className={`pb-2 md:pb-3 px-4 md:px-8 text-sm md:text-base font-medium hover:border-b-2 hover:border-[#E11936] hover:text-[#E11936] ${
                activeTab === "대기중"
                  ? "border-b-2 border-[#E11936] text-[#E11936]"
                  : "text-[#BFBFBF] border-transparent"
              }`}
              data-testid="tab-pending"
            >
              대기 {pendingCount}
            </button>
          </div>

          {/* 오른쪽 필터 + 검색 */}
          <div className="flex gap-3 items-center pb-3">
            <Select
              value={filterType}
              onValueChange={(value) =>
                setFilterType(value as "전체" | "부서" | "직책")
              }
            >
              <SelectTrigger
                data-testid="select-filter-type"
                className="w-[150px] px-4 py-2 border border-[#E9E9E9] rounded text-sm text-[#201E22] bg-white focus:outline-none focus:border-[#E11936]"
              >
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체">전체</SelectItem>
                <SelectItem value="부서">부서</SelectItem>
                <SelectItem value="직책">직책</SelectItem>
              </SelectContent>
            </Select>

            <input
              type="text"
              value={tempSearchQuery}
              onChange={(e) => setTempSearchQuery(e.target.value)}
              placeholder="검색어를 입력하세요"
              className="flex-1 px-4 py-2 border border-[#E9E9E9] rounded text-sm text-[#201E22] placeholder-[#BFBFBF] focus:outline-none focus:border-[#E11936]"
              data-testid="input-search"
            />
          </div>
        </div>

        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[12%_12%_18%_16%_15%_15%_12%] px-2 md:px-4 py-2 md:py-3 bg-[#F5F5F5] border-y border-[#E9E9E9] items-center shrink-0">
          <div className="text-xs md:text-sm font-semibold text-[#201E22]">아이디</div>
          <div className="text-xs md:text-sm font-semibold text-[#201E22]">이름</div>
          <div className="text-xs md:text-sm font-semibold text-[#201E22]">이메일</div>
          <div className="text-xs md:text-sm font-semibold text-[#201E22]">부서</div>
          <div className="text-xs md:text-sm font-semibold text-[#201E22]">직책</div>
          <div className="text-xs md:text-sm font-semibold text-[#201E22]">전화번호</div>
          <div className="text-xs md:text-sm font-semibold text-[#201E22]">관리</div>
        </div>

        {/* 테이블 바디 - 내부 스크롤 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* 로딩 상태 */}
          {isLoading ? (
            <div className="space-y-0">
              {Array.from({ length: itemsPerPage }).map((_, index) => (
                <SkeletonRow key={index} />
              ))}
            </div>
          ) : managers.length === 0 ? (
            /* 데이터 없는 상태 */
            <div className="flex items-center justify-center py-16 md:py-24 lg:py-32">
              <p className="text-sm md:text-base text-[#BFBFBF]">
                조회된 매니저가 없습니다.
              </p>
            </div>
          ) : (
            /* 데이터 리스트 */
            <div className="space-y-0">
              {managers.map((manager, index) => (
                <div
                  key={manager.id}
                  className="grid grid-cols-[12%_12%_18%_16%_15%_15%_12%] px-2 md:px-4 h-16 bg-white border-b border-[#E9E9E9] items-center text-xs md:text-sm text-[#201E22]"
                  data-testid={`manager-row-${index}`}
                >
                  <div
                    className="truncate text-[#414141]"
                    title={manager.username}
                  >
                    {manager.username}
                  </div>
                  <div className="truncate" title={manager.name}>
                    {manager.name}
                  </div>
                  <div
                    className="truncate text-[#414141]"
                    title={manager.email}
                  >
                    {manager.email}
                  </div>
                  <div
                    className="truncate text-[#414141]"
                    title={manager.department ?? undefined}
                  >
                    {manager.department}
                  </div>
                  <div
                    className="truncate text-[#414141]"
                    title={manager.position ?? undefined}
                  >
                    {manager.position}
                  </div>
                  <div
                    className="truncate text-[#414141]"
                    title={manager.phone}
                  >
                    {manager.phone}
                  </div>
                  <div className="flex gap-1">
                    {activeTab === "대기중" ? (
                      <button
                        onClick={() => handleApproveClick(manager)}
                        className="px-2 md:px-3 py-1 text-[10px] md:text-xs font-medium text-white bg-[#4285F4] rounded hover:bg-[#357AE8]"
                        data-testid={`button-approve-${index}`}
                      >
                        승인
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDeactivateClick(manager)}
                        className="px-2 md:px-3 py-1 text-[10px] md:text-xs font-medium text-white bg-[#E11936] rounded hover:bg-[#C71530]"
                        data-testid={`button-deactivate-${index}`}
                      >
                        삭제
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

      {/* 승인 확인 팝업 */}
      {approveConfirmOpen && selectedManagerForApprove && (
        <AdminSimpleConfirmPopup
          message={`${selectedManagerForApprove.name}님을 승인하시겠습니까?`}
          leftButtonText="취소"
          rightButtonText="승인"
          onLeftClick={() => setApproveConfirmOpen(false)}
          onRightClick={handleApproveConfirm}
        />
      )}

      {deactivateConfirmOpen && selectedManagerForDeactivate && (
        <AdminSimpleConfirmPopup
          message={`${selectedManagerForDeactivate.name}님을 삭제하시겠습니까? 삭제 후 재가입이 가능합니다.`}
          leftButtonText="취소"
          rightButtonText="삭제"
          onLeftClick={() => setDeactivateConfirmOpen(false)}
          onRightClick={handleDeactivateConfirm}
        />
      )}

    </AdminLayout>
  );
}
