import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "../adminLayout";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { apiRequest } from "@/lib/adminQueryClient";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";
import {
  MemberPlatformTabsBar,
  MemberTableEmpty,
  MemberTableLoading,
  MemberTableShell,
  memberCompactTableClass,
  memberRowClass,
  memberTdClass,
  memberThClass,
  truncateText,
  type MemberPaginatedMeta,
  type MemberPlatform,
} from "./memberAdminUi";

interface PointsRankingData {
  userId: string;
  username: string;
  name: string;
  email: string | null;
  earnedPoints: number;
}

type PointsResponse = MemberPaginatedMeta & {
  data: PointsRankingData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default function PointsRankingPage() {
  const [platform, setPlatform] = useState<MemberPlatform>("ppamong");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useResponsivePageSize();
  const { assets } = useAdminAssets();

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, platform]);

  const { data, isLoading } = useQuery<PointsResponse>({
    queryKey: ["admin-points-rankings", platform, currentPage, itemsPerPage],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/rankings/points?page=${currentPage}&limit=${itemsPerPage}&platform=${platform}`,
      );
      return res.json();
    },
  });

  const rankings = data?.data ?? [];
  const counts = data?.counts ?? { ppamong: 0, badminton9: 0 };
  const totalPages = data?.totalPages ?? 1;

  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-3" data-testid="breadcrumb">
        <span className="text-xs text-[#BFBFBF]">회원 관리</span>
        <span className="text-xs text-[#BFBFBF]">&gt;</span>
        <span className="text-xs text-[#201E22]">승리 획득 포인트 랭킹</span>
      </div>

      <h1
        className="text-lg font-semibold text-[#201E22] mb-3 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img src={assets.adListIcon} className="w-6 h-6" alt="" />
        승리 획득 포인트 랭킹
      </h1>

      <MemberPlatformTabsBar
        platform={platform}
        counts={counts}
        onChange={(next) => {
          setPlatform(next);
          setCurrentPage(1);
        }}
      />

      {isLoading ? (
        <MemberTableLoading rows={itemsPerPage} cols={5} />
      ) : rankings.length === 0 ? (
        <MemberTableEmpty
          message={
            platform === "ppamong"
              ? "빠몽 회원 포인트 기록이 없습니다."
              : "빠던9 레거시 포인트 기록이 없습니다."
          }
        />
      ) : (
        <MemberTableShell>
          <table className={memberCompactTableClass}>
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#E9E9E9] text-left">
                <th className={`${memberThClass} w-12 text-center`}>순위</th>
                <th className={memberThClass}>ID</th>
                <th className={`${memberThClass} w-20`}>이름</th>
                <th className={memberThClass}>이메일</th>
                <th className={`${memberThClass} w-24 text-right`}>획득 P</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((ranking, index) => {
                const rank = (currentPage - 1) * itemsPerPage + index + 1;
                return (
                  <tr
                    key={ranking.userId}
                    className={memberRowClass}
                    data-testid={`ranking-row-${index}`}
                  >
                    <td className={`${memberTdClass} text-center tabular-nums`}>{rank}</td>
                    <td className={memberTdClass} title={ranking.username}>
                      {truncateText(ranking.username, 18)}
                    </td>
                    <td className={memberTdClass}>{truncateText(ranking.name, 8)}</td>
                    <td className={memberTdClass} title={ranking.email ?? undefined}>
                      {truncateText(ranking.email, 22)}
                    </td>
                    <td className={`${memberTdClass} text-right font-semibold text-[#E11936] tabular-nums`}>
                      {ranking.earnedPoints.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </MemberTableShell>
      )}

      {(data?.total ?? 0) > 0 && (
        <AdminPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </AdminLayout>
  );
}
