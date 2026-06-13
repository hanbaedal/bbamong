import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "../adminLayout";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { apiRequest } from "@/lib/adminQueryClient";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";

interface VictoryRankingData {
  userId: string;
  username: string;
  name: string;
  email: string;
  victoryCount: number;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function VictoryRankingPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useResponsivePageSize();
  useEffect(() => { setCurrentPage(1); }, [itemsPerPage]);
  const { assets } = useAdminAssets();

  const { data, isLoading } = useQuery<PaginatedResponse<VictoryRankingData>>({
    queryKey: [`/api/rankings/victory?page=${currentPage}&limit=${itemsPerPage}`],
  });

  const rankings = data?.data || [];
  const totalPages = data?.total ? Math.ceil(data.total / itemsPerPage) : 1;

  function SkeletonRow() {
    return (
      <div className="flex items-center gap-2 md:gap-4 px-2 md:px-4 py-2 md:py-4 bg-white border-b border-[#E9E9E9] h-16">
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded flex-[10%] animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded flex-[30%] animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded flex-[20%] animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded flex-[30%] animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded flex-[15%] animate-pulse" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-6" data-testid="breadcrumb">
        <span className="text-sm text-[#BFBFBF]">회원 관리</span>
        <span className="text-sm text-[#BFBFBF]">&gt;</span>
        <span className="text-sm text-[#201E22]">승리 랭킹</span>
      </div>

      <h1
        className="text-2xl font-semibold text-[#201E22] mb-6 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img src={assets.adListIcon} className="w-8 h-8" alt="icon" /> 승리 랭킹
      </h1>

      <div className="flex gap-8 border-b border-[#E9E9E9] mb-6">
        <button
          className="pb-3 px-1 text-base font-medium border-b-2 border-[#E11936] text-[#E11936]"
          data-testid="tab-victory-ranking"
        >
          승리 랭킹
        </button>
      </div>

      {/* Table Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-[#F9F9F9] text-sm font-medium text-[#4D4B4E] mb-2">
        <div className="flex-[10%]">순위</div>
        <div className="flex-[30%]">ID</div>
        <div className="flex-[20%]">이름</div>
        <div className="flex-[30%] truncate">이메일</div>
        <div className="flex-[15%] text-right">승리 횟수</div>
      </div>

      {/* Table Rows */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: itemsPerPage }).map((_, index) => (
              <SkeletonRow key={index} />
            ))}
          </div>
        ) : rankings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <p className="text-base text-[#BFBFBF]">승리 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {rankings.map((ranking, index) => {
              const rank = (currentPage - 1) * itemsPerPage + index + 1;
              return (
                <div
                  key={ranking.userId}
                  className="flex min-h-16 items-center gap-4 px-4 py-4 bg-white border-b border-[#E9E9E9] text-sm text-[#201E22]"
                  data-testid={`ranking-row-${index}`}
                >
                  <div className="flex-[10%] font-medium">{rank}</div>
                  <div className="flex-[30%] truncate" title={ranking.username}>
                    {ranking.username && ranking.username.length > 16
                      ? `${ranking.username.substring(0, 16)}...`
                      : ranking.username}
                  </div>
                  <div className="flex-[20%] truncate" title={ranking.name}>
                    {ranking.name}
                  </div>
                  <div className="flex-[30%] truncate" title={ranking.email}>
                    {ranking.email}
                  </div>
                  <div className="flex-[15%] font-medium text-[#E11936] text-right">
                    {ranking.victoryCount?.toLocaleString() || 0}
                  </div>
                </div>
              );
            })}
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
