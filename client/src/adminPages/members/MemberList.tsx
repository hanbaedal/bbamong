import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/adminQueryClient";
import AdminLayout from "../adminLayout";
import { Button } from "@/components/ui/button";
import type { User } from "@shared/schema";
import AdminSimpleConfirmPopup from "@/components/customUi/AdminSimpleConfirmPopup";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useToast } from "@/hooks/use-toast";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";
import {
  MemberPlatformTabsBar,
  MemberTableEmpty,
  MemberTableLoading,
  MemberTableShell,
  formatCompactDate,
  formatCompactDateTime,
  memberCompactTableClass,
  memberRowClass,
  memberTheadRowClass,
  memberTdClass,
  memberThClass,
  truncateText,
  type MemberPaginatedMeta,
  type MemberPlatform,
} from "./memberAdminUi";

type UserWithoutPassword = Omit<User, "password" | "verificationCode">;

function isUserOnline(user: UserWithoutPassword): boolean {
  if (user.isSuspended === 1) return false;
  if (!user.lastActive) return false;

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const lastActiveDate = new Date(user.lastActive);
  const isRecentlyActive = lastActiveDate > fiveMinutesAgo;
  const isLoggedIn =
    !user.lastLogout || !user.lastLogin || new Date(user.lastLogin) > new Date(user.lastLogout);

  return isRecentlyActive && isLoggedIn;
}

type PopupAction = "softDelete" | "restore" | "hardDelete";

type MembersResponse = MemberPaginatedMeta & {
  data: UserWithoutPassword[];
  total: number;
  suspendedTotal: number;
};

export default function MemberListPage() {
  const [platform, setPlatform] = useState<MemberPlatform>("ppamong");
  const [activeTab, setActiveTab] = useState<"all" | "deleted">("all");
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [popupAction, setPopupAction] = useState<PopupAction>("softDelete");
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const { assets } = useAdminAssets();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [page, setPage] = useState(1);
  const limit = useResponsivePageSize();

  useEffect(() => {
    setPage(1);
  }, [limit, platform]);

  const { data, isLoading } = useQuery<MembersResponse>({
    queryKey: ["admin-members", platform, activeTab, page, limit],
    queryFn: async () => {
      const base =
        activeTab === "all"
          ? `/api/admin/regular-users?page=${page}&limit=${limit}`
          : `/api/admin/suspended-users?page=${page}&limit=${limit}`;

      const res = await apiRequest("GET", `${base}&platform=${platform}`);
      return res.json();
    },
    placeholderData: (previousData) => previousData,
  });

  const users = data?.data ?? [];
  const total = data?.total ?? 0;
  const suspendedTotal = data?.suspendedTotal ?? 0;
  const counts = data?.counts ?? { ppamong: 0, badminton9: 0 };
  const totalPages =
    activeTab === "all" ? Math.ceil(total / limit) : Math.ceil(suspendedTotal / limit);

  const deleteMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await apiRequest("DELETE", `/api/admin/regular-users/${userId}`);
      return response.json();
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/regular-users/${userId}/restore`);
      return response.json();
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await apiRequest("DELETE", `/api/admin/regular-users/${userId}/hard-delete`);
      return response.json();
    },
  });

  const handleConfirmAction = async () => {
    if (!selectedUser) return;

    if (popupAction === "softDelete" && confirmStep === 1) {
      setConfirmStep(2);
      return;
    }

    try {
      if (popupAction === "softDelete") {
        await deleteMutation.mutateAsync({ userId: selectedUser.id });
        toast({ description: "회원이 삭제되었습니다." });
      } else if (popupAction === "restore") {
        await restoreMutation.mutateAsync({ userId: selectedUser.id });
        toast({ description: "회원이 복구되었습니다." });
      } else if (popupAction === "hardDelete") {
        await hardDeleteMutation.mutateAsync({ userId: selectedUser.id });
        toast({ description: "회원이 완전히 삭제되었습니다." });
      }
      await qc.invalidateQueries({ queryKey: ["admin-members"] });
      setShowConfirmPopup(false);
      setSelectedUser(null);
      setConfirmStep(1);
    } catch (err) {
      console.error(err);
      const msg =
        popupAction === "restore" ? "회원 복구에 실패했습니다." : "회원 삭제에 실패했습니다.";
      toast({ description: msg, variant: "destructive" });
    }
  };

  const openPopup = (userId: string, userName: string, action: PopupAction) => {
    setSelectedUser({ id: userId, name: userName });
    setPopupAction(action);
    setConfirmStep(1);
    setShowConfirmPopup(true);
  };

  const handleCancelPopup = () => {
    setShowConfirmPopup(false);
    setSelectedUser(null);
    setConfirmStep(1);
  };

  const emptyMessage =
    activeTab === "all"
      ? platform === "ppamong"
        ? "빠몽 가입 회원이 없습니다."
        : "빠던9 레거시 회원이 없습니다."
      : "삭제된 회원이 없습니다.";

  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-3" data-testid="breadcrumb">
        <span className="text-xs text-[#BFBFBF]">회원 관리</span>
        <span className="text-xs text-[#BFBFBF]">&gt;</span>
        <span className="text-xs text-[#201E22]">회원 리스트</span>
      </div>

      <h1
        className="text-lg font-semibold text-[#201E22] mb-3 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img src={assets.adListIcon} className="w-6 h-6" alt="" />
        회원 리스트
      </h1>

      <MemberPlatformTabsBar
        platform={platform}
        counts={counts}
        onChange={(next) => {
          setPlatform(next);
          setPage(1);
        }}
      />

      <div className="flex gap-6 border-b border-[#E9E9E9] mb-3">
        <button
          type="button"
          onClick={() => {
            setActiveTab("all");
            setPage(1);
          }}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "all"
              ? "border-[#E11936] text-[#E11936]"
              : "border-transparent text-[#BFBFBF]"
          }`}
          data-testid="tab-all"
        >
          회원 {total}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("deleted");
            setPage(1);
          }}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "deleted"
              ? "border-[#E11936] text-[#E11936]"
              : "border-transparent text-[#BFBFBF]"
          }`}
          data-testid="tab-deleted"
        >
          삭제 {suspendedTotal}
        </button>
      </div>

      {isLoading ? (
        <MemberTableLoading rows={limit} cols={9} />
      ) : users.length === 0 ? (
        <MemberTableEmpty message={emptyMessage} />
      ) : (
        <MemberTableShell>
          <table className={`${memberCompactTableClass} min-w-[720px]`}>
            <thead>
              <tr className={memberTheadRowClass}>
                <th className={`${memberThClass} w-20 max-w-20`}>ID</th>
                <th className={`${memberThClass} w-16`}>이름</th>
                <th className={`${memberThClass} w-24`}>전화</th>
                <th className={`${memberThClass} w-16 text-right`}>P</th>
                <th className={`${memberThClass} w-20`}>가입</th>
                <th className={`${memberThClass} w-16 text-center`}>상태</th>
                <th className={`${memberThClass} w-28`}>로그인</th>
                <th className={`${memberThClass} w-28`}>로그아웃</th>
                <th className={`${memberThClass} w-24`}>관리</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => {
                const online = isUserOnline(user);
                return (
                  <tr key={user.id} className={memberRowClass} data-testid={`user-row-${index}`}>
                    <td className={`${memberTdClass} w-20 max-w-20`} title={user.username}>
                      {truncateText(user.username, 10)}
                    </td>
                    <td className={memberTdClass}>{truncateText(user.name, 6)}</td>
                    <td className={`${memberTdClass} tabular-nums`}>{user.phone || "—"}</td>
                    <td className={`${memberTdClass} text-right tabular-nums`}>
                      {user.points.toLocaleString()}
                    </td>
                    <td className={`${memberTdClass} tabular-nums whitespace-nowrap`}>
                      {formatCompactDate(user.createdAt)}
                    </td>
                    <td className={`${memberTdClass} text-center`}>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] ${
                          online ? "text-green-600" : "text-[#AAA]"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            online ? "bg-green-600" : "bg-[#CCC]"
                          }`}
                        />
                        {online ? "ON" : "OFF"}
                      </span>
                    </td>
                    <td className={`${memberTdClass} tabular-nums whitespace-nowrap text-[#666]`}>
                      {formatCompactDateTime(user.lastLogin)}
                    </td>
                    <td className={`${memberTdClass} tabular-nums whitespace-nowrap text-[#666]`}>
                      {formatCompactDateTime(user.lastLogout)}
                    </td>
                    <td className={memberTdClass}>
                      {activeTab === "all" ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openPopup(user.id, user.name, "softDelete")}
                          disabled={deleteMutation.isPending}
                          className="h-6 px-2 text-[10px]"
                          data-testid={`button-delete-${index}`}
                        >
                          삭제
                        </Button>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPopup(user.id, user.name, "restore")}
                            disabled={restoreMutation.isPending}
                            className="h-6 px-2 text-[10px]"
                            data-testid={`button-restore-${index}`}
                          >
                            복구
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openPopup(user.id, user.name, "hardDelete")}
                            disabled={hardDeleteMutation.isPending}
                            className="h-6 px-2 text-[10px]"
                            data-testid={`button-hard-delete-${index}`}
                          >
                            완삭제
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </MemberTableShell>
      )}

      {(activeTab === "all" ? total : suspendedTotal) > 0 && (
        <AdminPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {showConfirmPopup && selectedUser && (
        <AdminSimpleConfirmPopup
          message={
            popupAction === "softDelete"
              ? confirmStep === 1
                ? "계정을 영구적으로 탈퇴하시겠어요?"
                : "정말 탈퇴하시겠어요?"
              : popupAction === "restore"
                ? "해당 회원을 복구하시겠어요?"
                : "해당 회원을 완전히 삭제하시겠어요? 모든 데이터가 영구 삭제됩니다."
          }
          leftButtonText={
            popupAction === "softDelete" ? (confirmStep === 1 ? "아니요" : "취소하기") : "취소"
          }
          rightButtonText={
            popupAction === "softDelete"
              ? confirmStep === 1
                ? "네"
                : "탈퇴하기"
              : popupAction === "restore"
                ? "복구"
                : "삭제"
          }
          onLeftClick={handleCancelPopup}
          onRightClick={handleConfirmAction}
          rightButtonDisabled={
            deleteMutation.isPending || restoreMutation.isPending || hardDeleteMutation.isPending
          }
        />
      )}
    </AdminLayout>
  );
}
