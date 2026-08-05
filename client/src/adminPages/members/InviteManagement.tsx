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

interface InviteRankingRow {
  userId: string;
  username: string;
  name: string;
  email: string | null;
  inviteCount: number;
}

type InviteResponse = MemberPaginatedMeta & {
  data: InviteRankingRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default function InviteManagementPage() {
  const { assets } = useAdminAssets();
  const [platform, setPlatform] = useState<MemberPlatform>("ppamong");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useResponsivePageSize();

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, platform]);

  const { data, isLoading } = useQuery<InviteResponse>({
    queryKey: ["admin-invite-rankings", platform, currentPage, itemsPerPage],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/invite-rankings?page=${currentPage}&limit=${itemsPerPage}&platform=${platform}`,
      );
      return res.json();
    },
  });

  const invites = data?.data ?? [];
  const counts = data?.counts ?? { ppamong: 0, badminton9: 0 };
  const totalPages = data?.totalPages ?? 1;

  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-3" data-testid="breadcrumb">
        <span className="text-xs text-[#BFBFBF]">회원 관리</span>
        <span className="text-xs text-[#BFBFBF]">&gt;</span>
        <span className="text-xs text-[#201E22]">친구 초대 관리</span>
      </div>

      <h1
        className="text-lg font-semibold text-[#201E22] mb-3 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img src={assets.adListIcon} className="w-6 h-6" alt="" />
        팀 친구 초대 관리
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
      ) : invites.length === 0 ? (
        <MemberTableEmpty
          message={
            platform === "ppamong"
              ? "빠몽 회원 초대 기록이 없습니다."
              : "빠던9 레거시 초대 기록이 없습니다."
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
                <th className={`${memberThClass} w-20 text-right`}>초대 수</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite, index) => {
                const rank = (currentPage - 1) * itemsPerPage + index + 1;
                return (
                  <tr
                    key={invite.userId}
                    className={memberRowClass}
                    data-testid={`invite-row-${index}`}
                  >
                    <td className={`${memberTdClass} text-center tabular-nums`}>{rank}</td>
                    <td className={memberTdClass} title={invite.username}>
                      {truncateText(invite.username, 18)}
                    </td>
                    <td className={memberTdClass}>{truncateText(invite.name, 8)}</td>
                    <td className={memberTdClass} title={invite.email ?? undefined}>
                      {truncateText(invite.email, 22)}
                    </td>
                    <td className={`${memberTdClass} text-right font-semibold tabular-nums`}>
                      {invite.inviteCount.toLocaleString()}
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
