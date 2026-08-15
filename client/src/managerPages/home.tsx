import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { managerFetch, managerQueryClient, getFullUrl, dispatchManagerMatchEnded } from "@/lib/managerQueryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";
import { clearManagerTokens } from "@/lib/managerTokenManager";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { shouldClientPollMatch } from "@/lib/matchPollWindow";
import { setGameKeepAwake } from "@/lib/screenWakeLock";
import { useManagerProactiveSessionRefresh } from "@/hooks/useManagerProactiveSessionRefresh";
import ManagerGuideModal from "./ManagerGuideModal";

interface ManagerInfo {
  id: string;
  username: string;
  name: string;
  email: string;
  department: string;
  position: string;
  userType: string;
  approvalStatus: string;
}

interface Match {
  id: string;
  name: string;
  stadiumId: number;
  startTime: Date;
  endTime: Date;
  matchStatus: string;
  currentRound: number;
  predictionEnabled: boolean;
  stadium: {
    id: number;
    name: string;
  };
}

export default function ManagerHomePage() {
  const [, setLocation] = useLocation();
  const [manager, setManager] = useState<ManagerInfo | null>(null);
  const [isLoadingManager, setIsLoadingManager] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const { toast } = useToast();
  const matchEndedLogoutRef = useRef(false);
  const [showMatchEndedBanner, setShowMatchEndedBanner] = useState(false);

  // 경기 목록 조회 - 항상 최신 데이터 유지
  const { data: matches = [], isLoading: isLoadingMatches } = useQuery<Match[]>({
    queryKey: ["/api/manager/matches/today"],
    queryFn: async () => {
      const response = await managerFetch("/api/manager/matches/today");
      if (!response.ok) {
        throw new Error("Failed to fetch matches");
      }
      return response.json();
    },
    enabled: manager != null,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data = query.state.data as Match[] | undefined;
      if (!data?.some((m) => shouldClientPollMatch(m.startTime, m.matchStatus))) {
        return false;
      }
      return 10000;
    },
  });

  const hasActiveAssignedMatch = matches.some((m) =>
    shouldClientPollMatch(m.startTime, m.matchStatus),
  );

  useManagerProactiveSessionRefresh(hasActiveAssignedMatch);

  useEffect(() => {
    if (!hasActiveAssignedMatch) {
      void setGameKeepAwake(false);
      return;
    }
    void setGameKeepAwake(true);
    return () => {
      void setGameKeepAwake(false);
    };
  }, [hasActiveAssignedMatch]);

  useEffect(() => {
    fetchManagerInfo();
    
    const handleSessionExpired = async () => {
      await clearManagerTokens();
      managerQueryClient.clear();
      if (!Capacitor.isNativePlatform()) {
        fetch(getFullUrl("/api/manager/clear-session"), { method: "POST", credentials: "include" }).catch(() => {});
      }
      setManager(null);
      await new Promise(resolve => setTimeout(resolve, 0));
      setLocation("/manager/login");
    };
    
    const handleMatchEnded = async (event: Event) => {
      const message =
        (event as CustomEvent<{ message?: string }>).detail?.message ??
        "담당 경기가 종료되어 로그아웃되었습니다.";
      try {
        sessionStorage.setItem("manager-match-ended-message", message);
      } catch {
        /* ignore */
      }
      await clearManagerTokens();
      managerQueryClient.clear();
      if (!Capacitor.isNativePlatform()) {
        fetch(getFullUrl("/api/manager/clear-session"), { method: "POST", credentials: "include" }).catch(() => {});
      }
      setManager(null);
      await new Promise(resolve => setTimeout(resolve, 0));
      setLocation("/manager/login");
    };
    
    window.addEventListener("manager-session-expired", handleSessionExpired);
    window.addEventListener("manager-match-ended", handleMatchEnded);

    let appListenerHandle: { remove: () => void } | null = null;
    let isMounted = true;
    if (Capacitor.isNativePlatform()) {
      App.addListener("appStateChange", (state) => {
        if (state.isActive && isMounted) {
          managerQueryClient.invalidateQueries({ queryKey: ["/api/manager/matches/today"] });
        }
      }).then((handle) => {
        if (isMounted) {
          appListenerHandle = handle;
        } else {
          handle.remove();
        }
      });
    }

    return () => {
      isMounted = false;
      window.removeEventListener("manager-session-expired", handleSessionExpired);
      window.removeEventListener("manager-match-ended", handleMatchEnded);
      if (appListenerHandle) {
        appListenerHandle.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (isLoadingMatches || matchEndedLogoutRef.current) return;
    const assignedEnded = matches.some(
      (m) => m.matchStatus === "completed" || m.matchStatus === "cancelled",
    );
    if (assignedEnded) {
      matchEndedLogoutRef.current = true;
      try {
        sessionStorage.setItem("manager-match-ended-message", "담당 경기가 종료되어 로그아웃됩니다.");
      } catch {
        /* ignore */
      }
      setShowMatchEndedBanner(true);
      window.setTimeout(() => {
        dispatchManagerMatchEnded("담당 경기가 종료되어 로그아웃됩니다.");
      }, 10_000);
    }
  }, [matches, isLoadingMatches]);

  const fetchManagerInfo = async () => {
    try {
      const response = await managerFetch("/api/manager/me");

      if (response.ok) {
        const data = await response.json();
        setManager(data.manager);
      } else if (response.status === 401) {
        setLocation("/manager/login");
      } else {
        console.error("Failed to fetch manager info, status:", response.status);
      }
    } catch (error) {
      console.error("Failed to fetch manager info:", error);
    } finally {
      setIsLoadingManager(false);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await managerFetch("/api/manager/logout", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();

        if (response.status === 403) {
          toast({
            variant: "destructive",
            description: data.error || "관리자의 로그아웃 허가가 필요합니다.",
          });
          return;
        }

        throw new Error(data.error || "로그아웃 실패");
      }

      await clearManagerTokens();
      managerQueryClient.clear();
      if (!Capacitor.isNativePlatform()) {
        fetch(getFullUrl("/api/manager/clear-session"), { method: "POST", credentials: "include" }).catch(() => {});
      }
      setManager(null);
      await new Promise(resolve => setTimeout(resolve, 0));
      setLocation("/manager/login");
    } catch (error) {
      console.error("Logout failed:", error);
      toast({
        variant: "destructive",
        description: "로그아웃 중 오류가 발생했습니다.",
      });
    }
  };

  const isLoading = isLoadingManager || isLoadingMatches;

  if (isLoading) {
    return (
      <div className="h-[100dvh] bg-white w-full flex flex-col overflow-hidden" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 44px)' }}>
        {/* 헤더 스켈레톤 */}
        <div className="flex-shrink-0 px-5 py-3 flex items-center justify-between border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
        </div>

        {/* 메인 컨텐츠 스켈레톤 */}
        <div className="px-5 py-3">
          {/* 날짜 스켈레톤 */}
          <div className="h-3.5 w-48 bg-gray-200 rounded mb-2 animate-pulse"></div>

          {/* 제목 스켈레톤 */}
          <div className="h-5 w-28 bg-gray-200 rounded mb-2 animate-pulse"></div>

          {/* 경기 카드 스켈레톤 */}
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-4 w-20 bg-gray-200 rounded mb-2 animate-pulse"></div>
                    <div className="h-3.5 w-32 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-200 rounded-full animate-pulse"></div>
                    <div className="h-3.5 w-16 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const today = new Date();
  const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${["일", "월", "화", "수", "목", "금", "토"][today.getDay()]})`;

  return (
    <div className="h-[100dvh] bg-white w-full flex flex-col overflow-hidden" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 44px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }}>
      {/* 헤더 */}
      <div className="flex-shrink-0 px-5 py-3 flex items-center justify-between border-b border-gray-200 relative z-50">
        <div className="flex items-center gap-2">
          {/* 아이콘 영역 - 사용자가 나중에 추가 */}
          <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
          <span className="text-[16px] font-medium text-gray-900 max-w-[180px] truncate" data-testid="text-manager-name">
            운영자: {manager?.username || ""}
          </span>
        </div>
        <Button
          variant="outline"
          onClick={handleLogout}
          data-testid="button-logout"
          className="min-h-[44px] px-4 text-sm border-red-500 text-red-500 hover:bg-red-50"
        >
          로그아웃
        </Button>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 overflow-y-auto overscroll-none px-5 py-3" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* 날짜 */}
        <p className="text-[14px] text-gray-600 mb-2" data-testid="text-current-date">
          {formattedDate}
        </p>

        {/* 오늘의 경기 제목 */}
        <h2 className="text-[18px] font-bold text-gray-900 mb-2">
          오늘의 경기
        </h2>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            data-testid="button-open-guide"
            className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-left hover:bg-gray-50"
          >
            <p className="text-[15px] font-semibold text-gray-900">사용 설명</p>
            <p className="text-[12px] text-gray-500 mt-1">운영 순서 안내</p>
          </button>
          <button
            type="button"
            onClick={() => setLocation("/manager/simulation")}
            data-testid="button-open-simulation"
            className="rounded-lg border border-[#1A6DFF]/30 bg-[#1A6DFF]/5 px-3 py-3 text-left hover:bg-[#1A6DFF]/10"
          >
            <p className="text-[15px] font-semibold text-[#1A6DFF]">시뮬레이션</p>
            <p className="text-[12px] text-gray-500 mt-1">연습 모드 (실제 반영 없음)</p>
          </button>
        </div>

        {/* 경기 리스트 */}
        <div className="space-y-2">
          {matches.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-600 text-[14px]">오늘 예정된 경기가 없습니다.</p>
            </div>
          ) : (
            matches.map((match, index) => {
              const isAvailable = match.matchStatus === "scheduled" || match.matchStatus === "ongoing";
              const displayStadium = getDisplayStadiumName(match.stadium.name);
              
              return (
                <button
                  key={match.id}
                  onClick={() => setLocation(`/manager/match/${match.id}`)}
                  data-testid={`button-match-${match.id}`}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[16px] font-medium text-gray-900">
                        {match.name}
                      </p>
                      {displayStadium && (
                        <p className="text-[14px] text-gray-600 mt-1">
                          {displayStadium}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${isAvailable ? "bg-[#CDFF00]" : "bg-red-500"}`}></div>
                      <span className="text-[14px] text-gray-600">
                        {isAvailable ? "입장 가능" : "입장 불가"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <ManagerGuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onOpenSimulation={() => {
          setGuideOpen(false);
          setLocation("/manager/simulation");
        }}
      />
    </div>
  );
}
