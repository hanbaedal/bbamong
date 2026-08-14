import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface DailyRecord {
  date: string;
  total: number;
  wins: number;
  losses: number;
  pending: number;
}

interface PredictionResponse {
  success: boolean;
  days?: DailyRecord[];
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

function formatDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  return format(date, "yyyy년 M월 d일 (EEE)", { locale: ko });
}

function formatDayRecord(day: DailyRecord) {
  const parts = [`${day.total}전`, `${day.wins}승`, `${day.losses}패`];
  if (day.pending > 0) {
    parts.push(`${day.pending}대기`);
  }
  return parts.join(" ");
}

export default function VictoryHistoryPage() {
  const { assets } = useUserAssets();
  const [currentPage, setCurrentPage] = useState(1);
  const [allDays, setAllDays] = useState<DailyRecord[]>([]);

  const { data, isLoading, isFetching } = useQuery<PredictionResponse>({
    queryKey: [`/api/users/predictions?page=${currentPage}&limit=10&group=day`],
    refetchOnMount: "always",
  });

  useEffect(() => {
    setAllDays([]);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    if (data?.days) {
      setAllDays((prev) => {
        const dayMap = new Map(prev.map((day) => [day.date, day]));
        data.days?.forEach((day) => {
          dayMap.set(day.date, day);
        });
        return Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date));
      });
    }
  }, [data]);

  const handleLoadMore = () => {
    if (isFetching || !data || currentPage >= data.pagination.totalPages) {
      return;
    }
    setCurrentPage((prev) => prev + 1);
  };

  const getDayColor = (day: DailyRecord) => {
    if (day.wins > 0 && day.losses === 0 && day.pending === 0) {
      return "bg-gradient-to-l from-[#E11936] to-[#111111]";
    }
    return "bg-[#1C1F20]";
  };

  return (
    <div className="h-app-screen bg-[#111111] flex flex-col">
      <PageHeader />

      <div className="flex-1 overflow-y-scroll-touch pt-[10px] pb-bottom-nav-with-bar">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">승리현황</h1>
        <div className="px-5 mt-[10px]">
        <div className="relative w-full h-[86px] bg-[#1C1F20] rounded-lg ">
          <div
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{
              padding: "1px",
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
          <div className="absolute right-[25px] top-[-13px] w-[87px] h-[112px] bg-transparent">
            <img
              src={assets.victoryImg}
              alt="Mascot"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      </div>

      <div className="px-5 mt-[40px]">
        <h2 className="text-[#E9E9E9] text-lg font-semibold">최근 기록</h2>
      </div>

      <div className="px-5 mt-[14px] flex flex-col gap-[14px]">
        {isLoading && currentPage === 1 ? (
          <div className="text-white text-center py-8">로딩중...</div>
        ) : allDays.length > 0 ? (
          allDays.map((day) => (
            <div
              key={day.date}
              className={`w-full min-h-[71px] rounded-xl ${getDayColor(day)} px-4 py-[13px] flex items-center justify-between`}
              data-testid={`prediction-day-${day.date}`}
            >
              <div className="text-white/60 text-xs font-medium">
                {formatDayLabel(day.date)}
              </div>
              <div className="text-white text-sm font-semibold">
                {formatDayRecord(day)}
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
