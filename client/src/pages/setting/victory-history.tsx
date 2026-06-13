import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useLocation } from "wouter";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface PredictionHistory {
  id: number;
  prediction: string;
  amount: number;
  status: string;
  wonAmount: number;
  createdAt: string;
  matchId: string;
  matchName: string;
  matchDate: string;
  stadiumName: string;
}

interface PredictionResponse {
  success: boolean;
  predictions: PredictionHistory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statistics: {
    total: number;
    wins: number;
    losses: number;
    pending: number;
  };
  currentUserRank: {
    rank: number;
    victories: number;
  } | null;
}

export default function VictoryHistoryPage() {
  const [, setLocation] = useLocation();
  const { assets } = useUserAssets();
  const [currentPage, setCurrentPage] = useState(1);
  const [allPredictions, setAllPredictions] = useState<PredictionHistory[]>([]);

  const { data, isLoading, isFetching } = useQuery<PredictionResponse>({
    queryKey: [`/api/users/predictions?page=${currentPage}&limit=5`],
    refetchOnMount: "always",
  });

  // 컴포넌트 마운트 시 상태 초기화
  useEffect(() => {
    setAllPredictions([]);
    setCurrentPage(1);
  }, []);

  // 새로운 데이터가 로드되면 누적 및 업데이트
  useEffect(() => {
    if (data?.predictions) {
      setAllPredictions((prev) => {
        // ID를 키로 하는 맵 생성
        const predictionMap = new Map(prev.map((p) => [p.id, p]));

        // 새 데이터로 맵 업데이트 (기존 레코드 교체 또는 추가)
        data.predictions.forEach((p) => {
          predictionMap.set(p.id, p);
        });

        // 맵을 배열로 변환하고 createdAt 기준으로 내림차순 정렬
        return Array.from(predictionMap.values()).sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      });
    }
  }, [data]);

  const handleLoadMore = () => {
    // 로딩 중이거나 마지막 페이지면 무시
    if (isFetching || !data || currentPage >= data.pagination.totalPages) {
      return;
    }
    setCurrentPage((prev) => prev + 1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "yyyy년 M월 d일 (EEE)", { locale: ko });
  };

  const getStatusText = (status: string) => {
    if (status === "success") return "예측 성공";
    if (status === "fail") return "예측 실패";
    return "예측 대기";
  };

  const getStatusColor = (status: string) => {
    if (status === "success")
      return "bg-gradient-to-l from-[#E11936] to-[#111111]";
    return "bg-[#1C1F20]";
  };

  return (
    <div className="h-app-screen bg-[#111111] flex flex-col">
      {/* 헤더 */}
      <PageHeader />

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-scroll-touch pt-[10px] pb-bottom-nav-with-bar">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">승리현황</h1>
        <div className="px-5 mt-[10px]">
        <div className="relative w-full h-[86px] bg-[#1C1F20] rounded-lg ">
          <div
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{
              padding: "1px", // border 두께
              backgroundImage: "linear-gradient(to right, #CDFF00, #97862A)",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "destination-out",
              maskComposite: "exclude",
            }}
          ></div>
          {isLoading ? (
            <div className="text-[#E9E9E9] text-[28px] font-bold leading-[140%] tracking-tight mt-1 p-4">
              로딩중...
            </div>
          ) : data ? (
            // <>
            //   {data.currentUserRank && (
            //     <div className="flex gap-2 items-center invisible">
            //       <img
            //         src={assets.crownIcon}
            //         className="w-5 h-5 object-contain"
            //       ></img>
            //       <div
            //         className="text-[#CDFF00] text-lg font-medium mt-1 h-auto"
            //         data-testid="text-user-rank"
            //       >
            //         현재 랭킹 {data.currentUserRank.rank}위
            //       </div>
            //     </div>
            //   )}
            //   <div className="text-[#E9E9E9] text-[18px] font-bold leading-[140%] tracking-tight mt-1">
            //     {data.statistics.total}전 {data.statistics.wins}승{" "}
            //     {data.statistics.losses}패
            //   </div>
            // </>
            <div className="flex flex-col p-4"><span className="text-[#BFBFBF] text-[12px]">예측 전적</span>
            <div className="text-[#E9E9E9] text-[28px] font-bold leading-[140%] tracking-tight mt-1">
              {data.statistics.total}전 {data.statistics.wins}승
                  {data.statistics.losses}패
            </div></div>
          ) : (
            <div className="text-[#E9E9E9] text-[28px] font-bold leading-[140%] tracking-tight mt-1">
              0전 0승 0패
            </div>
          )}
          {/* 우측 마스코트 이미지 자리 */}
          <div className="absolute right-[25px] top-[-13px] w-[87px] h-[112px] bg-transparent">
            <img
              src={assets.victoryImg}
              alt="Mascot"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      </div>

      {/* 최근 기록 섹션 */}
      <div className="px-5 mt-[40px]">
        <h2 className="text-[#E9E9E9] text-lg font-semibold">최근 기록</h2>
      </div>

      {/* 게임 결과 목록 */}
      <div className="px-5 mt-[14px] flex flex-col gap-[14px]">
        {isLoading && currentPage === 1 ? (
          <div className="text-white text-center py-8">로딩중...</div>
        ) : allPredictions.length > 0 ? (
          allPredictions.map((prediction) => (
            <div
              key={prediction.id}
              className={`w-full h-[71px] rounded-xl ${getStatusColor(prediction.status)} px-4 py-[13px] flex items-center justify-between`}
              data-testid={`prediction-item-${prediction.id}`}
            >
              <div className="flex flex-col gap-1">
                <div className="text-white/60 text-xs font-medium">
                  {prediction.matchDate
                    ? formatDate(prediction.matchDate)
                    : formatDate(prediction.createdAt)}
                </div>
                <div className="text-white text-sm font-medium">
                  {prediction.matchName} {prediction.stadiumName}
                </div>
              </div>
              <div className="text-white text-sm font-semibold">
                {getStatusText(prediction.status)}
              </div>
            </div>
          ))
        ) : (
          <div className="text-white/60 text-center py-8">
            예측 내역이 없습니다.
          </div>
        )}
        {isLoading && currentPage > 1 && (
          <div className="text-white/60 text-center py-4">로딩중...</div>
        )}
      </div>

        {/* 더보기 버튼 */}
        {data && currentPage < data.pagination.totalPages && (
          <div className="px-5 mt-6 mb-8 flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={isFetching}
              data-testid="button-load-more"
              className="flex items-center gap-1 text-white text-sm font-medium hover:text-[#CDFF00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isFetching ? "로딩중..." : "더보기"}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <BottomNavigation />
    </div>
  );
}
