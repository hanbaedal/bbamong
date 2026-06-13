import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "../adminLayout";
import type { User } from "@shared/schema";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { apiRequest } from "@/lib/adminQueryClient";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";

type UserWithoutPassword = Omit<User, "password" | "verificationCode">;

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}


export default function DonationRankingsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useResponsivePageSize();
  useEffect(() => { setCurrentPage(1); }, [itemsPerPage]);
  const {assets} = useAdminAssets()

  const { data, isLoading } = useQuery<PaginatedResponse<UserWithoutPassword>>({
    queryKey: ["/api/admin/donation-rankings", currentPage, itemsPerPage],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/donation-rankings?page=${currentPage}&limit=${itemsPerPage}`
      );
      return res.json();
    },
  });

  const donors = data?.data || [];
  const totalPages = data?.total
  ? Math.ceil(data.total / itemsPerPage)
  : 1;

  function SkeletonRow() {
    return (
      <div className="flex h-16 items-center gap-2 md:gap-4 px-2 md:px-4 py-2 md:py-4 bg-white border-b border-[#E9E9E9]">
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded flex-[15%] animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded flex-[30%] animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded flex-[20%] animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded flex-[20%] animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded flex-[15%] animate-pulse" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-3 md:mb-4 lg:mb-6" data-testid="breadcrumb">
        <span className="text-xs md:text-sm text-[#BFBFBF]">회원 관리</span>
        <span className="text-xs md:text-sm text-[#BFBFBF]">&gt;</span>
        <span className="text-xs md:text-sm text-[#201E22]">사회공헌참여기록 관리</span>
      </div>

      <h1
        className="text-lg md:text-xl lg:text-2xl font-semibold text-[#201E22] mb-3 md:mb-4 lg:mb-6 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img src={assets.adListIcon} className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" alt="icon" /> 사회공헌참여기록 관리
      </h1>

      <div className="flex gap-4 md:gap-6 lg:gap-8 border-b border-[#E9E9E9] mb-3 md:mb-4 lg:mb-6">
        <button
          className="pb-2 md:pb-3 px-1 text-sm md:text-base font-medium border-b-2 border-[#E11936] text-[#E11936]"
          data-testid="tab-donation-rankings"
        >
          사회공헌참여기록 관리
        </button>
      </div>

      {/* Table Header */}
      <div className="flex items-center gap-4 px-2 md:px-4 py-2 md:py-3 bg-[#F9F9F9] text-xs md:text-sm font-medium text-[#4D4B4E] mb-2">
        <div className="flex-[15%]">순위</div>
        <div className="flex-[30%]">ID</div>
        <div className="flex-[20%]">이름</div>
        <div className="flex-[20%] truncate">이메일</div>
        <div className="flex-[15%] text-left">공헌기록</div>
      </div>

      {/* Table Rows */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: itemsPerPage }).map((_, index) => (
              <SkeletonRow key={index} />
            ))}
          </div>
        ) : donors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 md:py-24 lg:py-32">
            <p className="text-sm md:text-base text-[#BFBFBF]">기부 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-0 h-full">
            {donors.map((donor, index) => {
              const rank = (currentPage - 1) * itemsPerPage + index + 1;
              return (
                <div
                  key={donor.id}
                  className="flex h-16 items-center gap-4 px-2 md:px-4 py-2 md:py-4 bg-white border-b border-[#E9E9E9] text-xs md:text-sm text-[#201E22]"
                  data-testid={`donor-row-${index}`}
                >
                  <div className="flex-[15%] font-medium">{rank}</div>
                  <div className="flex-[30%] truncate" title={donor.username}>
                    {donor.username && donor.username.length > 16
                      ? `${donor.username.substring(0, 16)}...`
                      : donor.username}
                  </div>
                  <div className="flex-[20%] truncate" title={donor.name}>
                    {donor.name}
                  </div>
                  <div className="flex-[20%] truncate" title={donor.email ?? undefined}>
                    {donor.email}
                  </div>
                  <div className="flex-[15%] font-medium text-[#E11936] text-left">
                    {donor.totalDonationAmount?.toLocaleString() || 0}
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
