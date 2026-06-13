import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/adminQueryClient";
import AdminLayout from "../adminLayout";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Stadium {
  id: number;
  name: string;
  createdAt: string;
}

interface Match {
  id: string;
  name: string;
  stadiumId: number;
  startTime: string;
  endTime: string;
  matchStatus: string;
}

interface MatchForm {
  id?: string;
  stadiumId: string;
  startHour: string;
  startMinute: string;
  status: string;
}

export default function MatchManagement() {
  const queryClient = useQueryClient();
  // URL 쿼리 파라미터에서 탭 정보 읽기
  const searchParams = new URLSearchParams(window.location.search);
  const tabFromUrl = searchParams.get("tab") as "stadiums" | "matches" | null;

  const [activeTab, setActiveTab] = useState<"stadiums" | "matches">(
    tabFromUrl || "matches",
  );
  const [showAddStadiumModal, setShowAddStadiumModal] = useState(false);
  const [showAddMatchModal, setShowAddMatchModal] = useState(false);
  const [stadiumName, setStadiumName] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteForceConfirmOpen, setDeleteForceConfirmOpen] = useState(false);
  const [deleteForceMessage, setDeleteForceMessage] = useState("");
  const [selectedStadium, setSelectedStadium] = useState<Stadium | null>(null);
  const { toast } = useToast();
  const { user } = useUser();
  const isSuperAdmin = user?.userType === "슈퍼어드민";
  const [matchDate, setMatchDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`; // 로컬 시간 기준 yyyy-mm-dd 포맷
  });
  const [matches, setMatches] = useState<MatchForm[]>(
    Array(5)
      .fill(null)
      .map(() => ({
        stadiumId: "",
        startHour: "",
        startMinute: "",
        status: "정상",
      })),
  );
  // 경기 탭 페이지네이션 및 확장 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const pageSize = useResponsivePageSize();
  const itemsPerPage = Math.max(3, Math.floor(pageSize * 64 / 96));
  useEffect(() => { setCurrentPage(1); }, [itemsPerPage]);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { assets } = useAdminAssets();

  // 날짜 확장/축소 토글
  const toggleDateExpand = (dateKey: string) => {
    setExpandedDates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  };

  // 날짜를 "2025년 9월 4일" 형식으로 변환
  const formatDateToKorean = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
  };

  const { data: stadiums, isLoading } = useQuery<Stadium[]>({
    queryKey: ["/api/admin/stadiums"],
  });

  const { data: matchesData, isLoading: matchesLoading } = useQuery<Match[]>({
    queryKey: ["/api/admin/matches"],
  });

  // 날짜가 변경될 때 해당 날짜의 경기를 불러와서 폼에 채우기
  useEffect(() => {
    if (matchDate && matchesData) {
      const selectedDateMatches = matchesData.filter((match) => {
        // matchDate 필드가 있으면 우선 사용, 없으면 startTime에서 UTC 날짜 추출
        const matchWithDate = match as Match & { matchDate?: string | null };
        if (matchWithDate.matchDate) {
          return matchWithDate.matchDate === matchDate;
        }
        // 레거시 데이터: startTime에서 KST 날짜 추출
        const utcDate = new Date(match.startTime);
        const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
        const formattedDate = `${kstDate.getUTCFullYear()}-${String(kstDate.getUTCMonth() + 1).padStart(2, "0")}-${String(kstDate.getUTCDate()).padStart(2, "0")}`;
        return formattedDate === matchDate;
      });

      // 경기 번호 추출 (예: "1경기" -> 0, "2경기" -> 1)
      const newMatches: MatchForm[] = Array(5)
        .fill(null)
        .map(() => ({
          id: undefined,
          stadiumId: "",
          startHour: "",
          startMinute: "",
          status: "정상",
        }));

      selectedDateMatches.forEach((match) => {
        const matchNumber = parseInt(match.name.replace("경기", "")) - 1;
        if (matchNumber >= 0 && matchNumber < 5) {
          const startTime = new Date(match.startTime);

          const statusMap: Record<string, string> = {
            scheduled: "정상",
            cancelled: "취소",
            postponed: "연기",
            completed: "종료",
          };

          const kstTime = new Date(startTime.getTime() + 9 * 60 * 60 * 1000);
          const rawMinute = kstTime.getUTCMinutes();
          const roundedMinute = Math.round(rawMinute / 5) * 5 % 60;
          newMatches[matchNumber] = {
            id: match.id,
            stadiumId: match.stadiumId.toString(),
            startHour: String(kstTime.getUTCHours()).padStart(2, "0"),
            startMinute: String(roundedMinute).padStart(2, "0"),
            status: statusMap[match.matchStatus] || "정상",
          };
        }
      });

      setMatches(newMatches);
    }
  }, [matchDate, matchesData]);

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/admin/stadiums", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stadiums"] });
      setShowAddStadiumModal(false);
      setStadiumName("");
      toast({ description: "구장이 추가되었습니다." });
    },
    onError: (err: any) => {
      console.error("구장 추가 실패:", err);
      setShowAddStadiumModal(false);
      toast({
        variant: "destructive",
        description: err?.message || "구장 추가에 실패했습니다.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, force }: { id: number; force?: boolean }) => {
      const url = force ? `/api/admin/stadiums/${id}?force=true` : `/api/admin/stadiums/${id}`;
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        throw { status: res.status, ...data };
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stadiums"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      setDeleteConfirmOpen(false);
      setDeleteForceConfirmOpen(false);
      toast({ description: "구장이 삭제되었습니다." });
    },
    onError: (err: any) => {
      console.error("구장 삭제 실패:", err);
      if (err?.status === 409 && err?.requireConfirm) {
        setDeleteConfirmOpen(false);
        setDeleteForceMessage(err.message);
        setDeleteForceConfirmOpen(true);
        return;
      }
      setDeleteConfirmOpen(false);
      setDeleteForceConfirmOpen(false);
      toast({
        variant: "destructive",
        description: err?.message || "구장 삭제에 실패했습니다.",
      });
    },
  });

  const createMatchesMutation = useMutation({
    mutationFn: async (matchesData: any[]) => {
      return await apiRequest("POST", "/api/admin/matches/batch", matchesData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      setShowAddMatchModal(false);
      toast({ description: "경기가 등록되었습니다." });
    },
    onError: (err: any) => {
      console.error("경기 등록 실패:", err);
      setShowAddMatchModal(false);
      toast({
        variant: "destructive",
        description: err?.message || "경기 등록에 실패했습니다.",
      });
    },
  });

  const handleAddStadium = () => {
    if (!stadiumName.trim()) {
      toast({ variant: "destructive", description: "구장명을 입력해주세요." });
      return;
    }
    createMutation.mutate(stadiumName);
  };

  const handleDeleteClick = (stadium: Stadium) => {
    setSelectedStadium(stadium);
    setDeleteConfirmOpen(true);
  };

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${year}${month}${day}`;
  }

  function formatMatchDateUTC(dateString: string) {
    const date = new Date(dateString);
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const year = kst.getUTCFullYear();
    const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
    const day = String(kst.getUTCDate()).padStart(2, "0");
    return `${year}. ${month}.${day}`;
  }

  // 경기 데이터를 날짜별로 그룹화 (matchDate 필드 우선 사용)
  const groupedMatches =
    matchesData?.reduce(
      (acc, match) => {
        const matchWithDate = match as Match & { matchDate?: string | null };
        // matchDate 필드 우선 사용, 없으면 startTime에서 UTC 날짜 추출
        let dateKey: string;
        if (matchWithDate.matchDate) {
          dateKey = matchWithDate.matchDate;
        } else {
          // 레거시 데이터: startTime에서 KST 날짜 추출
          const utcDate = new Date(match.startTime);
          const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
          dateKey = `${kstDate.getUTCFullYear()}-${String(kstDate.getUTCMonth() + 1).padStart(2, "0")}-${String(kstDate.getUTCDate()).padStart(2, "0")}`;
        }

        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(match);
        return acc;
      },
      {} as Record<string, Match[]>,
    ) || {};

  const handleDeleteConfirm = () => {
    if (selectedStadium) {
      deleteMutation.mutate({ id: selectedStadium.id });
    }
  };

  const handleForceDeleteConfirm = () => {
    if (selectedStadium) {
      deleteMutation.mutate({ id: selectedStadium.id, force: true });
    }
  };

  const handleMatchChange = (
    index: number,
    field: keyof MatchForm,
    value: string,
  ) => {
    const newMatches = [...matches];
    newMatches[index] = { ...newMatches[index], [field]: value };
    setMatches(newMatches);
  };

  const handleSaveMatches = () => {
    if (!matchDate) {
      toast({ variant: "destructive", description: "날짜를 선택해주세요." });
      return;
    }

    // 상태 매핑
    const statusMap: Record<string, string> = {
      정상: "scheduled",
      취소: "cancelled",
      연기: "postponed",
      종료: "completed",
    };

    const validMatchesWithIndex = matches
      .map((match, originalIndex) => ({ match, originalIndex }))
      .filter(
        ({ match }) => match.stadiumId && match.startHour && match.startMinute,
      );

    const validMatches = validMatchesWithIndex.map(
      ({ match, originalIndex }) => {
        const startTime = `${matchDate}T${match.startHour}:${match.startMinute}:00+09:00`;
        const endTime = startTime;

        return {
          ...(match.id && { id: match.id }),
          name: `${originalIndex + 1}경기`,
          stadiumId: parseInt(match.stadiumId),
          startTime: startTime,
          endTime: endTime,
          matchStatus: statusMap[match.status] || "scheduled",
          matchDate: matchDate,
        };
      },
    );

    if (validMatches.length === 0) {
      toast({ variant: "destructive", description: "등록할 경기 정보를 입력해주세요." });
      return;
    }

    createMatchesMutation.mutate(validMatches);
  };

  const hourOptions: string[] = [];
  for (let h = 0; h < 24; h++) {
    hourOptions.push(String(h).padStart(2, "0"));
  }

  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-6" data-testid="breadcrumb">
        <span className="text-sm text-[#BFBFBF]">경기 관리</span>
      </div>
      <h1
        className="text-2xl font-semibold text-[#201E22] mb-6 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img src={assets.adListIcon} className="w-8 h-8" alt="icon" /> 경기 관리
      </h1>

      <div className="flex justify-between mb-6 border-b border-[#E9E9E9]">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("matches")}
            className={`pb-3 px-11 text-base font-medium hover:border-b-2 hover:border-[#E11936] hover:text-[#E11936] ${
              activeTab === "matches"
                ? "border-b-2 border-[#E11936] text-[#E11936]"
                : "text-[#BFBFBF] border-transparent"
            }`}
            data-testid="tab-matches"
          >
            경기
          </button>
          <button
            onClick={() => setActiveTab("stadiums")}
            className={`pb-3 px-8 text-base font-medium hover:border-b-2 hover:border-[#E11936] hover:text-[#E11936] ${
              activeTab === "stadiums"
                ? "border-b-2 border-[#E11936] text-[#E11936]"
                : "text-[#BFBFBF] border-transparent"
            }`}
            data-testid="tab-stadiums"
          >
            경기 구장
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowAddMatchModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 w-[105px] h-[40px] bg-[#CCF501] text-[#201E22] rounded font-medium text-sm mb-3"
            data-testid="button-add-match"
          >
            + 경기 등록
          </button>
          <button
            onClick={() => setShowAddStadiumModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 w-[105px] h-[40px] bg-[#E11936] text-white rounded font-medium text-sm "
            data-testid="button-add-stadium"
          >
            + 구장 추가
          </button>
        </div>
      </div>

      {activeTab === "stadiums" && (
        <>
          <div className="grid grid-cols-[30%_50%_20%] px-4 py-3 bg-[#F9F9F9] text-sm font-medium text-[#4D4B4E] mb-2">
            <div>등록일</div>
            <div>구장명</div>
            <div>관리</div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {isLoading ? (
              <div className="space-y-0">
                {Array.from({ length: pageSize }).map((_, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[30%_50%_20%] px-4 py-5 bg-white border-b border-[#E9E9E9] items-center h-16"
                  >
                    <div className="h-3.5 bg-[#E9E9E9] rounded w-32 animate-pulse" />
                    <div className="h-3.5 bg-[#E9E9E9] rounded w-32 animate-pulse" />
                    <div className="h-3.5 bg-[#E9E9E9] rounded w-16 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : !stadiums || stadiums.length === 0 ? (
              <div className="flex items-center justify-center py-16 md:py-24 lg:py-32 text-[#BFBFBF] text-sm">
                등록된 구장이 없습니다.
              </div>
            ) : (
              stadiums?.map((stadium) => (
                <div
                  key={stadium.id}
                  className="grid grid-cols-[30%_50%_20%] px-4 py-5 bg-white border-b border-[#E9E9E9] items-center h-16"
                  data-testid={`row-stadium-${stadium.id}`}
                >
                  <div
                    className="truncate"
                    title={formatDate(stadium.createdAt)}
                  >
                    {formatDate(stadium.createdAt)}
                  </div>
                  <div className="truncate" title={stadium.name}>
                    {stadium.name}
                  </div>
                  <div>
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDeleteClick(stadium)}
                        data-testid={`button-delete-${stadium.id}`}
                        className="px-3 py-1 text-xs font-medium text-[#E11936] border border-[#E11936] rounded hover:bg-[#FDE0E4]"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {activeTab === "matches" && (
        <>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {matchesLoading ? (
              <div className="space-y-0">
                {Array.from({ length: itemsPerPage }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-4 py-3 mb-3 bg-white border border-[#E9E9E9] rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-3.5 bg-[#E9E9E9] rounded w-40 animate-pulse" />
                      <div className="bg-[#E9E9E9] rounded w-[60px] h-[60px] animate-pulse" />
                    </div>
                    <div className="h-5 bg-[#E9E9E9] rounded w-5 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : !matchesData || matchesData.length === 0 ? (
              <div className="flex items-center justify-center py-16 md:py-24 lg:py-32 text-[#BFBFBF] text-sm w-full">
                등록된 경기가 없습니다.
              </div>
            ) : (
              (() => {
                // 날짜별로 그룹화한 경기 (필터링 제거)
                const allGroupedMatches = Object.entries(groupedMatches);

                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedMatches = allGroupedMatches.slice(
                  startIndex,
                  endIndex,
                );

                return (
                  <>
                    {paginatedMatches.length === 0 ? (
                      <div className="flex items-center justify-center py-32 text-[#BFBFBF] text-sm w-full">
                        등록된 경기가 없습니다.
                      </div>
                    ) : (
                      <div className="flex flex-col h-full gap-4 w-full">
                        {paginatedMatches.map(([dateKey, dateMatches]) => {
                          const firstMatch = dateMatches[0];
                          const isExpanded = expandedDates.has(dateKey);

                          // 경기명 순서대로 정렬 (1경기, 2경기, ...)
                          const sortedMatches = [...dateMatches].sort(
                            (a, b) => {
                              const aNum =
                                parseInt(a.name.replace("경기", "")) || 0;
                              const bNum =
                                parseInt(b.name.replace("경기", "")) || 0;
                              return aNum - bNum;
                            },
                          );

                          return (
                            <div
                              key={dateKey}
                              className="flex items-center gap-3 bg-white min-h-[80px]"
                              data-testid={`date-group-${dateKey}`}
                            >
                              {/* 날짜 카드 (클릭 가능) - 고정 */}
                              <div
                                onClick={() => toggleDateExpand(dateKey)}
                                className="flex-shrink-0 flex items-center justify-center p-4 md:p-6 lg:p-8 cursor-pointer hover:bg-[#F9F9F9] border border-[#E9E9E9] rounded-lg transition h-full min-w-[140px] md:min-w-[160px] lg:min-w-[180px]"
                                data-testid={`button-toggle-${dateKey}`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-sm md:text-base lg:text-[16px] font-semibold text-[#201E22] whitespace-nowrap">
                                    {formatMatchDateUTC(firstMatch.startTime)}
                                  </span>
                                </div>
                              </div>

                              {/* 경기 목록 컨테이너 - 오른쪽으로 가로 스크롤 */}
                              <div
                                className={`overflow-hidden transition-all duration-300 h-full ${
                                  isExpanded
                                    ? "flex-1 opacity-100"
                                    : "w-0 max-w-0 opacity-0"
                                }`}
                              >
                                <div
                                  className={`flex gap-3 transition-transform duration-300 h-full overflow-x-auto ${
                                    isExpanded
                                      ? "translate-x-0"
                                      : "-translate-x-full"
                                  }`}
                                >
                                  {sortedMatches.map((match) => {
                                    const matchIndex = sortedMatches.findIndex(
                                      (m) => m.id === match.id,
                                    );
                                    return (
                                      <Link
                                        key={match.id}
                                        className="flex-shrink-0 min-w-[140px] md:min-w-[160px] lg:min-w-[180px] h-full"
                                        href={`/admin/match-monitoring/${encodeURIComponent(dateKey)}?matchIndex=${matchIndex}`}
                                      >
                                        <div
                                          className="flex justify-between h-full px-3 md:px-4 lg:px-5 border border-[#F9F9F9] items-center rounded-lg cursor-pointer bg-[#F9F9F9] hover:border-[#E11936] transition min-h-[80px]"
                                          data-testid={`match-card-${match.id}`}
                                        >
                                          {/* 경기명 */}
                                          <span className="text-sm md:text-base lg:text-[18px] font-medium text-[#201E22] whitespace-nowrap">
                                            {match.name}
                                          </span>
                                          <img
                                            src={assets.adMatchCharaterIcon}
                                            className="h-[50px] md:h-[60px] aspect-square pl-1 md:pl-2 ml-2 md:ml-4"
                                          ></img>
                                          <div className="flex gap-1 md:gap-[6px] items-center justify-end h-full">
                                            <img
                                              src={assets.adRightArrowIcon}
                                              className="w-4 h-4 md:w-5 md:h-5 object-contain"
                                            ></img>
                                          </div>
                                        </div>
                                      </Link>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>

          {!matchesLoading &&
            matchesData &&
            matchesData.length > 0 &&
            (() => {
              const allGroupedMatches = Object.entries(groupedMatches);
              const totalPages = Math.ceil(
                allGroupedMatches.length / itemsPerPage,
              );

              return (
                <AdminPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              );
            })()}
        </>
      )}

      {/* 경기 등록 모달 */}
      {showAddMatchModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
          onClick={() => setShowAddMatchModal(false)}
          data-testid="modal-match-overlay"
        >
          <div
            className="bg-white rounded-[10px] px-8 py-6 w-[700px] max-h-[80vh] overflow-auto font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-[18px] font-semibold text-[#201E22] tracking-[-0.025em]">
                  야구 경기 등록
                </h2>

                {/* 커스텀 날짜 선택 버튼 */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => dateInputRef.current?.showPicker()}
                    className="flex items-center justify-center gap-[10px] px-5 py-[10px] w-[200px] h-[42px] bg-[#E11936] rounded"
                    data-testid="button-match-date"
                  >
                    <span className="font-['Pretendard'] font-medium text-[16px] leading-[140%] tracking-[-0.025em] text-white whitespace-nowrap">
                      {matchDate ? formatDateToKorean(matchDate) : "날짜 선택"}
                    </span>
                    <div className="w-5 h-5 flex items-center justify-center">
                      <img
                        src={assets.adCalanderIcon}
                        className="w-5 h-5 object-cover"
                      ></img>
                    </div>
                  </button>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                    className="absolute opacity-0 pointer-events-none"
                    data-testid="input-match-date"
                  />
                </div>
              </div>
              <button
                onClick={() => setShowAddMatchModal(false)}
                className="w-6 h-6 flex items-center justify-center"
                data-testid="button-close-match-modal"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 6L18 18M6 18L18 6"
                    stroke="#201E22"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* 테이블 헤더 */}
            <div className="grid grid-cols-[80px_1fr_1fr_1fr_100px] gap-2 mb-2 text-[12px] font-medium text-[#4D4B4E]">
              <div>경기</div>
              <div>경기구장</div>
              <div>시작 시</div>
              <div>시작 분</div>
              <div>경기 상태</div>
            </div>

            {/* 경기 행들 */}
            {matches.map((match, index) => {
              const selectedStadiumIds = matches
                .map((m, i) =>
                  i !== index && m.stadiumId ? m.stadiumId : null,
                )
                .filter((id) => id !== null);

              return (
                <div
                  key={index}
                  className="grid grid-cols-[80px_1fr_1fr_1fr_100px] gap-2 mb-3"
                >
                  <div className="flex items-center text-[14px] text-[#201E22]">
                    {index + 1}경기
                  </div>

                  {/* 경기구장 */}
                  <Select
                    value={match.stadiumId}
                    onValueChange={(value) =>
                      handleMatchChange(index, "stadiumId", value)
                    }
                  >
                    <SelectTrigger
                      className={`h-[38px] border border-[#E9E9E9] rounded text-[14px] ${
                        match.stadiumId ? "text-[#201E22]" : "text-[#BFBFBF]"
                      }`}
                      data-testid={`select-stadium-${index}`}
                    >
                      <SelectValue placeholder="구장 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {stadiums?.map((stadium) => {
                        const isDisabled = selectedStadiumIds.includes(
                          stadium.id.toString(),
                        );
                        return (
                          <SelectItem
                            key={stadium.id}
                            value={stadium.id.toString()}
                            disabled={isDisabled}
                            className={isDisabled ? "text-[#BFBFBF]" : ""}
                          >
                            {stadium.name}
                            {isDisabled ? " (사용 중)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  {/* 시작 시 */}
                  <Select
                    value={match.startHour}
                    onValueChange={(value) =>
                      handleMatchChange(index, "startHour", value)
                    }
                  >
                    <SelectTrigger
                      className={`h-[38px] border border-[#E9E9E9] rounded text-[14px] ${
                        match.startHour ? "text-[#201E22]" : "text-[#BFBFBF]"
                      }`}
                      data-testid={`select-start-hour-${index}`}
                    >
                      <SelectValue placeholder="시" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {hourOptions.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}시
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* 시작 분 */}
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={match.startMinute}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val === "") {
                        handleMatchChange(index, "startMinute", "");
                        return;
                      }
                      const num = parseInt(val, 10);
                      if (isNaN(num)) return;
                      if (num > 59) return;
                      if (num < 0) return;
                      handleMatchChange(index, "startMinute", String(num).padStart(2, "0"));
                    }}
                    placeholder="분"
                    className={`h-[38px] w-full border border-[#E9E9E9] rounded text-[14px] px-3 outline-none focus:border-[#201E22] ${
                      match.startMinute ? "text-[#201E22]" : "text-[#BFBFBF]"
                    }`}
                    data-testid={`input-start-minute-${index}`}
                  />

                  {/* 경기 상태 */}
                  <Select
                    value={match.status}
                    onValueChange={(value) =>
                      handleMatchChange(index, "status", value)
                    }
                  >
                    <SelectTrigger
                      className="h-[38px] border border-[#E9E9E9] rounded text-[14px] text-[#201E22]"
                      data-testid={`select-status-${index}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="정상">정상</SelectItem>
                      <SelectItem value="취소">취소</SelectItem>
                      <SelectItem value="연기">연기</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}

            {/* 저장 버튼 */}
            <button
              onClick={handleSaveMatches}
              className="w-full mt-6 py-3 rounded-[8px] text-[16px] font-semibold bg-black text-white tracking-[-0.025em]"
              data-testid="button-save-matches"
            >
              저장하기
            </button>
          </div>
        </div>
      )}

      {/* 구장 추가 모달 */}
      {showAddStadiumModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
          onClick={() => setShowAddStadiumModal(false)}
          data-testid="modal-overlay"
        >
          <div
            className="bg-white rounded-[10px] flex flex-col items-center px-5 pb-[39px] pt-0 gap-[60px]"
            style={{
              width: "447px",
              height: "343px",
              fontFamily: "Pretendard, -apple-system, sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex flex-col items-center gap-5 w-full pt-0"
              style={{ width: "407px" }}
            >
              <div
                className="flex items-center justify-between w-full px-2"
                style={{ height: "60px" }}
              >
                <h2
                  className="text-[18px] font-semibold leading-[140%]"
                  style={{
                    color: "#201E22",
                    letterSpacing: "-0.025em",
                  }}
                >
                  경기구장 추가
                </h2>
                <button
                  onClick={() => setShowAddStadiumModal(false)}
                  className="w-6 h-6 flex items-center justify-center"
                  data-testid="button-close-modal"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 6L18 18M6 18L18 6"
                      stroke="#201E22"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <div
                className="flex flex-col items-start gap-2 w-full"
                style={{ height: "82px" }}
              >
                <label
                  className="text-[14px] font-medium leading-[140%]"
                  style={{
                    color: "#4D4B4E",
                    letterSpacing: "-0.025em",
                  }}
                >
                  구장명
                </label>
                <div
                  className="flex flex-col justify-center items-center px-2 py-[14px] gap-[10px] w-full bg-white"
                  style={{
                    height: "54px",
                    borderBottom: "1px solid #373539",
                  }}
                >
                  <input
                    type="text"
                    placeholder="구장 명을 입력해 주세요"
                    value={stadiumName}
                    onChange={(e) => setStadiumName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleAddStadium();
                      }
                    }}
                    className="w-full text-[16px] leading-[160%] outline-none"
                    style={{
                      color: stadiumName ? "#201E22" : "#BFBFBF",
                      letterSpacing: "-0.025em",
                      fontFamily: "Pretendard, -apple-system, sans-serif",
                    }}
                    data-testid="input-stadium-name"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleAddStadium}
              disabled={!stadiumName.trim()}
              className="flex items-center justify-center px-[14px] py-[10px] rounded-[8px] w-full disabled:opacity-50 mt-4"
              style={{
                width: "407px",
                height: "52px",
                background: "#111111",
              }}
              data-testid="button-submit-stadium"
            >
              <span
                className="text-[16px] font-semibold leading-[140%]"
                style={{
                  color: "#FFFFFF",
                  letterSpacing: "-0.025em",
                }}
              >
                추가하기
              </span>
            </button>
          </div>
        </div>
      )}

      {deleteConfirmOpen && selectedStadium && (
        <SimpleConfirmPopup
          message={`${selectedStadium.name} 구장을 삭제하시겠습니까?`}
          leftButtonText="취소"
          rightButtonText="삭제하기"
          onLeftClick={() => setDeleteConfirmOpen(false)}
          onRightClick={handleDeleteConfirm}
        />
      )}

      {deleteForceConfirmOpen && selectedStadium && (
        <SimpleConfirmPopup
          message={`${deleteForceMessage} 정말 삭제하시겠습니까?`}
          leftButtonText="취소"
          rightButtonText="삭제하기"
          onLeftClick={() => setDeleteForceConfirmOpen(false)}
          onRightClick={handleForceDeleteConfirm}
        />
      )}
    </AdminLayout>
  );
}
