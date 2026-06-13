import { useState, useEffect, useRef, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useLocation } from "wouter";
import { useUser } from "@/contexts/UserContext";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { queryClient, apiRequest } from "@/lib/queryClient";

type TabType = "all" | "earned" | "spent";

interface PointTransaction {
  id: number;
  userId: string;
  transactionType: string;
  amount: number;
  balance: number;
  description: string;
  createdAt: Date;
}

export default function PointHistoryPage() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const { assets } = useUserAssets();

  // 페이지 진입 시 유저 정보 강제 최신화
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
    console.log("포인트 내역 페이지 진입 - 유저 정보 최신화");
  }, [user?.id]);

  // 무한 스크롤을 위한 포인트 내역 조회
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<PointTransaction[]>({
      queryKey: ["/api/point-transactions", user?.id],
      queryFn: async ({ pageParam = 0 }) => {
        // user가 없으면 빈 배열 반환
        if (!user?.id) {
          return [];
        }

        const response = await apiRequest(
          "GET",
          `/api/point-transactions/${user.id}?limit=20&offset=${pageParam}`
        );
        return response.json();
      },
      getNextPageParam: (lastPage, allPages) => {
        // 마지막 페이지에서 받은 데이터가 20개 미만이면 더 이상 없음
        if (lastPage.length < 20) return undefined;
        // 다음 페이지의 offset 계산
        return allPages.length * 20;
      },
      initialPageParam: 0,
      enabled: !!user?.id,
    });

  // 모든 페이지의 데이터를 하나의 배열로 합치기
  const transactions = data?.pages.flatMap((page) => page) ?? [];

  const formatPoints = (points: number) => {
    const sign = points >= 0 ? "+" : "";
    return `${sign}${points.toLocaleString("ko-KR")}`;
  };

  const formatBalance = (balance: number) => {
    return `보유 ${balance.toLocaleString("ko-KR")}`;
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${month}.${day} ${hours}:${minutes}`;
  };

  const filteredHistory = transactions.filter((item) => {
    if (activeTab === "earned")
      return ["earned", "attendance", "donated"].includes(item.transactionType);
    if (activeTab === "spent")
      return ["donation", "spent"].includes(item.transactionType);
    return true; // all
  });

  // IntersectionObserver를 위한 ref
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // IntersectionObserver 콜백
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  // IntersectionObserver 설정
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
    });

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  return (
    <div className="h-app-screen bg-[#111111]">
      {/* 헤더 */}
      <PageHeader />

      {/* 컨텐츠 영역 */}
      <div className="flex-1 flex flex-col gap-6 pt-[10px] overflow-y-scroll-touch pb-bottom-nav">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">참여 기록 내역</h1>

        {/* 보유 포인트 박스 */}
        <div className="px-5">
          <div
            className="relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#1C1F20] h-[65px] overflow-hidden"
          >
            <div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                padding: "1px",
                backgroundImage: "linear-gradient(to right, #CDFF00, #97862A)",
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "destination-out",
                maskComposite: "exclude",
              }}
            ></div>

            <span className="text-[#BFBFBF] text-sm font-medium">
              보유 참여기회
            </span>
            <span className="text-white text-2xl font-bold tracking-tight">
              {user?.points}
            </span>
          </div>
        </div>

        {/* 탭 */}
        <div className="px-5">
          <div className="flex">
            <button
              data-testid="tab-all"
              onClick={() => setActiveTab("all")}
              className={`flex-1 pt-6 pb-3 text-sm font-medium transition-colors relative ${
                activeTab === "all" ? "text-white" : "text-[#6B6B6B]"
              }`}
            >
              전체
              {activeTab === "all" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#CDFF00]" />
              )}
            </button>
            <button
              data-testid="tab-earned"
              onClick={() => setActiveTab("earned")}
              className={`flex-1 pt-6 pb-3 text-sm font-medium transition-colors relative ${
                activeTab === "earned" ? "text-white" : "text-[#6B6B6B]"
              }`}
            >
              획득
              {activeTab === "earned" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#CDFF00]" />
              )}
            </button>
            <button
              data-testid="tab-spent"
              onClick={() => setActiveTab("spent")}
              className={`flex-1 pt-6 pb-3 text-sm font-medium transition-colors relative ${
                activeTab === "spent" ? "text-white" : "text-[#6B6B6B]"
              }`}
            >
              사용
              {activeTab === "spent" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#CDFF00]" />
              )}
            </button>
          </div>
        </div>

        {/* 내역 리스트 또는 빈 상태 */}
        {isLoading ? (
          <div className="px-5">
            {[1, 2, 3, 4, 5].map((index) => (
              <div
                key={index}
                className="py-4 border-b border-[#373539] animate-pulse"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="h-3 bg-[#1A1A1A] rounded w-20 mb-2"></div>
                    <div className="h-4 bg-[#1A1A1A] rounded w-32"></div>
                  </div>
                  <div className="text-right">
                    <div className="h-4 bg-[#1A1A1A] rounded w-16 mb-2 ml-auto"></div>
                    <div className="h-3 bg-[#1A1A1A] rounded w-20 ml-auto"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-5 py-20">
            <img
              src={assets.noCommentImg}
              alt="No point history"
              className="w-[150px] aspect-square mb-4"
            />
            <p
              className="text-[#6B6B6B] text-sm"
              data-testid="text-empty-message"
            >
              {activeTab === "all" && "참여 기록 내역이 없습니다."}
              {activeTab === "earned" && "획득한 참여 기록 내역이 없습니다."}
              {activeTab === "spent" && "사용한 참여 기록 내역이 없습니다."}
            </p>
          </div>
        ) : (
          <div className="px-5">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                data-testid={`history-item-${item.id}`}
                className="py-4 border-b border-[#373539]"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-[#6B6B6B] text-xs mb-1">
                      {formatDate(item.createdAt)}
                    </p>
                    <p className="text-white text-sm truncate">{item.description}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-base font-bold mb-1 ${
                        item.amount >= 0 ? "text-[#FF3B30]" : "text-white"
                      }`}
                    >
                      {formatPoints(item.amount)}
                    </p>
                    <p className="text-[#6B6B6B] text-xs">
                      {formatBalance(item.balance)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* 무한 스크롤 트리거 */}
            <div ref={loadMoreRef} className="py-4">
              {isFetchingNextPage && (
                <div className="flex justify-center">
                  <div className="w-6 h-6 border-2 border-[#CDFF00] border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <BottomNavigation />
    </div>
  );
}
