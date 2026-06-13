import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/adminQueryClient";
import AdminLayout from "../adminLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import debounce from "lodash.debounce";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";

interface ManagerWithAssignment {
  id: string;
  username: string;
  name: string;
  userType: string;
  status: string;
  lastLogin: Date | null;
  assignedMatchNumber: string | null; // "1경기", "2경기", etc.
}

interface MatchWithStadium {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  matchStatus: string;
  stadiumName: string;
}

interface ManagerListResponse {
  managers: ManagerWithAssignment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ManagerMatchAssignmentPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { assets } = useAdminAssets();
  const [searchQuery, setSearchQuery] = useState("");
  const [tempSearchQuery, setTempSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"전체" | "활성화" | "비활성">(
    "전체",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useResponsivePageSize();
  useEffect(() => { setCurrentPage(1); }, [itemsPerPage]);

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
      }, 500),
    [],
  );

  useEffect(() => {
    debouncedSearch(tempSearchQuery);
    return () => debouncedSearch.cancel();
  }, [tempSearchQuery, debouncedSearch]);

  const {
    data,
    isLoading: isLoadingManagers,
    refetch,
  } = useQuery<ManagerListResponse>({
    queryKey: [
      `/api/admin/manager-match-assignments?search=${searchQuery}&page=${currentPage}&limit=${itemsPerPage}`,
    ],
  });

  // ✅ 페이지 진입 시 무조건 1회 요청 (최신 데이터 보장)
  useEffect(() => {
    refetch();
  }, []);

  const managers = data?.managers || [];
  const totalPages = data?.totalPages || 1;

  const { data: matches, isLoading: isLoadingMatches } = useQuery<
    MatchWithStadium[]
  >({
    queryKey: ["/api/admin/manager-match-assignments/matches"],
  });

  const assignMutation = useMutation({
    mutationFn: async ({
      managerId,
      matchNumber,
    }: {
      managerId: string;
      matchNumber: string;
    }) => {
      return await apiRequest(
        "POST",
        "/api/admin/manager-match-assignments/assign",
        { managerId, matchNumber },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          `/api/admin/manager-match-assignments?search=${searchQuery}&page=${currentPage}&limit=${itemsPerPage}`,
        ],
      });
      toast({
        title: "성공",
        description: "경기가 할당되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "경기 할당에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (managerId: string) => {
      return await apiRequest(
        "POST",
        "/api/admin/manager-match-assignments/unassign",
        { managerId },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          `/api/admin/manager-match-assignments?search=${searchQuery}&page=${currentPage}&limit=${itemsPerPage}`,
        ],
      });
      toast({
        title: "성공",
        description: "경기 할당이 해제되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "오류",
        description: "경기 할당 해제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      managerId,
      status,
    }: {
      managerId: string;
      status: string;
    }) => {
      return await apiRequest(
        "PATCH",
        `/api/admin/manager-match-assignments/${managerId}/status`,
        { status },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          `/api/admin/manager-match-assignments?search=${searchQuery}&page=${currentPage}&limit=${itemsPerPage}`,
        ],
      });
      toast({
        title: "성공",
        description: "매니저 상태가 업데이트되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "오류",
        description: "매니저 상태 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleMatchChange = (managerId: string, matchNumber: string) => {
    if (matchNumber === "unassign") {
      unassignMutation.mutate(managerId);
    } else {
      assignMutation.mutate({ managerId, matchNumber });
    }
  };

  const handleStatusChange = (managerId: string, currentStatus: string) => {
    const newStatus = currentStatus === "활성화" ? "비활성화" : "활성화";
    statusMutation.mutate({ managerId, status: newStatus });
  };

  const getAvailableMatches = (currentAssignedMatchNumber: string | null) => {
    if (!matches) return [];

    // 이미 다른 매니저에게 할당된 경기 번호들
    const assignedMatchNumbers = new Set(
      (managers || [])
        .filter(
          (m) =>
            m.assignedMatchNumber !== null &&
            m.assignedMatchNumber !== currentAssignedMatchNumber,
        )
        .map((m) => m.assignedMatchNumber),
    );

    // 할당 가능한 경기 번호만 필터링 (경기 번호 기준으로 그룹화)
    const uniqueMatchNumbers = new Set<string>();
    const availableMatches: MatchWithStadium[] = [];

    for (const match of matches) {
      if (
        !uniqueMatchNumbers.has(match.name) &&
        !assignedMatchNumbers.has(match.name)
      ) {
        uniqueMatchNumbers.add(match.name);
        availableMatches.push(match);
      }
    }

    return availableMatches;
  };

  const formatMatchLabel = (match: MatchWithStadium) => {
    return match.name;
  };

  return (
    <AdminLayout>
      {/* Breadcrumb */}
      <div
        className="flex items-center gap-2 mb-3 md:mb-4 lg:mb-6"
        data-testid="breadcrumb"
      >
        <span className="text-xs md:text-sm text-muted-foreground">
          운영자 관리
        </span>
        <span className="text-xs md:text-sm text-muted-foreground">&gt;</span>
        <span className="text-xs md:text-sm">운영자 경기 할당 관리</span>
      </div>

      <h1
        className="text-lg md:text-xl lg:text-2xl font-semibold text-[#201E22] mb-3 md:mb-4 lg:mb-6 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img
          src={assets.adListIcon}
          className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8"
          alt="icon"
        />{" "}
        운영자 경기 할당 관리
      </h1>

      {/* Top Controls: Tabs, Dropdown, Search */}
      <div className="flex justify-between border-b border-[#E9E9E9] mb-3 md:mb-4 lg:mb-6">
        {/* 왼쪽 탭 */}
        <div className="flex gap-2 md:gap-4">
          <button
            className={`pb-2 md:pb-3 px-4 md:px-8 text-sm md:text-base font-medium border-b-2 border-[#E11936] text-[#E11936]`}
            data-testid="tab-approved"
          >
            경기할당
          </button>
        </div>

        {/* 오른쪽 필터 + 검색 */}
        <div className="flex gap-3 items-center pb-3">
          <Select
            value={filterType}
            onValueChange={(value) =>
              setFilterType(value as "전체" | "활성화" | "비활성")
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
              <SelectItem value="활성화">활성화</SelectItem>
              <SelectItem value="비활성">비활성</SelectItem>
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

      {/* Header */}
      <div className="grid grid-cols-[20%_15%_15%_15%_20%_15%] px-2 md:px-4 py-2 md:py-3 bg-[#F9F9F9] text-xs md:text-sm font-medium text-[#4D4B4E] mb-2">
        <div>운영자 ID</div>
        <div>상태</div>
        <div>권한</div>
        <div>담당 경기</div>
        <div>마지막 로그인</div>
        <div>관리</div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingManagers || isLoadingMatches ? (
          <div className="space-y-0">
            {Array.from({ length: itemsPerPage }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-[20%_15%_15%_15%_20%_15%] px-2 md:px-4 py-2 md:py-5 bg-white border-b border-[#E9E9E9] h-16 items-center"
              >
                {/* username */}
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>

                {/* status */}
                <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse"></div>

                {/* userType */}
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>

                {/* assignedMatch */}
                <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse"></div>

                {/* lastLogin */}
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>

                {/* action button */}
                <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : managers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 md:py-24 lg:py-32">
            <p className="text-sm md:text-base text-[#BFBFBF]">
              등록된 매니저가 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {managers.map((manager) => (
              <div
                key={manager.id}
                className="grid grid-cols-[20%_15%_15%_15%_20%_15%] px-2 md:px-4 py-2 md:py-5 bg-white text-xs md:text-sm text-[#201E22] items-center h-16"
              >
                <div className="truncate" title={manager.username}>
                  {manager.username}
                </div>
                <div>
                  <span
                    className={`inline-flex items-center justify-center w-[60px] py-1.5 rounded text-sm font-medium ${
                      manager.status === "활성화"
                        ? "bg-[#D4EDDA] text-[#008013]"
                        : "bg-[#E75C5D] text-white"
                    }`}
                  >
                    {manager.status}
                  </span>
                </div>
                <div>{manager.userType}</div>
                <div>
                  <Select
                    value={manager.assignedMatchNumber || ""}
                    onValueChange={(value) =>
                      handleMatchChange(manager.id, value)
                    }
                    disabled={
                      assignMutation.isPending || unassignMutation.isPending
                    }
                  >
                    <SelectTrigger className="w-2/3 h-10 px-2 border border-gray-200 rounded bg-white text-gray-900">
                      <SelectValue placeholder="담당 경기 없음" />
                    </SelectTrigger>
                    <SelectContent>
                      {manager.assignedMatchNumber && (
                        <SelectItem value="unassign">담당 경기 없음</SelectItem>
                      )}
                      {getAvailableMatches(manager.assignedMatchNumber).map(
                        (match) => (
                          <SelectItem key={match.id} value={match.name}>
                            {formatMatchLabel(match)}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="whitespace-pre-line">
                  {manager.lastLogin
                    ? format(
                        new Date(manager.lastLogin),
                        "yyyy. M. d.\naa h:mm:ss",
                        {
                          locale: ko,
                        },
                      )
                    : "-"}
                </div>
                <div>
                  <button
                    onClick={() =>
                      handleStatusChange(manager.id, manager.status)
                    }
                    disabled={statusMutation.isPending}
                    className={`w-[60px] py-1 text-[10px] md:text-xs font-medium text-white rounded ${
                      statusMutation.isPending
                        ? "bg-red-500 opacity-50 cursor-not-allowed"
                        : "bg-red-500 hover:bg-red-600"
                    }`}
                  >
                    {manager.status === "활성화" ? "비활성화" : "활성화"}
                  </button>
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
    </AdminLayout>
  );
}
