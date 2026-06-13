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

type UserWithoutPassword = Omit<User, "password" | "verificationCode">;

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function formatDateTimeTwoLines(
  date: Date | string | null | undefined,
): string {
  if (!date) return "-";
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "오후" : "오전";
  hours = hours % 12 || 12;
  const hourStr = String(hours).padStart(2, "0");

  return `${year}.${month}.${day}\n${ampm} ${hourStr}.${minutes}.${seconds}`;
}

function isUserOnline(user: UserWithoutPassword): boolean {
  if (user.isSuspended === 1) return false;
  if (!user.lastActive) return false;
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const lastActiveDate = new Date(user.lastActive);
  
  const isRecentlyActive = lastActiveDate > fiveMinutesAgo;
  const isLoggedIn = !user.lastLogout || !user.lastLogin || new Date(user.lastLogin) > new Date(user.lastLogout);
  
  return isRecentlyActive && isLoggedIn;
}

type PopupAction = "softDelete" | "restore" | "hardDelete";

export default function MemberListPage() {
  const [activeTab, setActiveTab] = useState<"all" | "deleted">("all");
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [popupAction, setPopupAction] = useState<PopupAction>("softDelete");
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const {assets} = useAdminAssets();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [page, setPage] = useState(1);
  const limit = useResponsivePageSize();

  useEffect(() => { setPage(1); }, [limit]);

  const { data, isLoading, refetch } = useQuery<{
    data: UserWithoutPassword[];
    total: number;
    suspendedTotal: number;
  }>({
    queryKey: ["admin-members", activeTab, page, limit],
    queryFn: async () => {
      const endpoint =
        activeTab === "all"
          ? `/api/admin/regular-users?page=${page}&limit=${limit}`
          : `/api/admin/suspended-users?page=${page}&limit=${limit}`;

      const res = await apiRequest("GET", endpoint);
      return res.json();
    },
    placeholderData: (previousData) => previousData,
  });


  const users = data?.data ?? [];
  const total = data?.total ?? 0;
  const suspendedTotal = data?.suspendedTotal ?? 0;
  const totalPages =
    activeTab === "all"
      ? Math.ceil(total / limit)
      : Math.ceil(suspendedTotal / limit);
  
  const deleteMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await apiRequest(
        "DELETE",
        `/api/admin/regular-users/${userId}`,
      );
      return response.json();
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/admin/regular-users/${userId}/restore`,
      );
      return response.json();
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await apiRequest(
        "DELETE",
        `/api/admin/regular-users/${userId}/hard-delete`,
      );
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
      const msg = popupAction === "restore" ? "회원 복구에 실패했습니다." : "회원 삭제에 실패했습니다.";
      toast({ description: msg, variant: "destructive" });
    }
  };

  const filteredUsers = users.filter((user) => {
    if (activeTab === "all") {
      return user.isSuspended === 0;
    } else {
      return user.isSuspended === 1;
    }
  });

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


  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-3 md:mb-4 lg:mb-6" data-testid="breadcrumb">
        <span className="text-xs md:text-sm text-[#BFBFBF]">회원 관리</span>
        <span className="text-xs md:text-sm text-[#BFBFBF]">&gt;</span>
        <span className="text-xs md:text-sm text-[#201E22]">회원 리스트</span>
      </div>

      <h1
        className="text-lg md:text-xl lg:text-2xl font-semibold text-[#201E22] mb-3 md:mb-4 lg:mb-6 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img src={assets.adListIcon} className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" alt="icon" /> 회원 리스트
      </h1>

      <div className="flex gap-4 md:gap-6 lg:gap-8 border-b border-[#E9E9E9] mb-3 md:mb-4 lg:mb-6">
        <button
          onClick={() => {setActiveTab("all"); setPage(1)}}
          className={`pb-2 md:pb-3 px-1 text-sm md:text-base font-medium border-b-2 transition-colors ${
            activeTab === "all"
              ? "border-[#E11936] text-[#E11936]"
              : "border-transparent text-[#BFBFBF]"
          }`}
          data-testid="tab-all"
        >
          회원 {total}
        </button>
        <button
          onClick={() => {setActiveTab("deleted"); setPage(1)}}
          className={`pb-2 md:pb-3 px-1 text-sm md:text-base font-medium border-b-2 transition-colors ${
            activeTab === "deleted"
              ? "border-[#E11936] text-[#E11936]"
              : "border-transparent text-[#BFBFBF]"
          }`}
          data-testid="tab-deleted"
        >
          삭제된 회원 {suspendedTotal}
        </button>
      </div>

      {isLoading ? (
        <>
          <div className="grid grid-cols-[14%,8%,14%,7%,10%,9%,13%,13%,12%] px-2 md:px-4 py-2 md:py-3 bg-[#F9F9F9] text-xs md:text-sm font-medium text-[#4D4B4E] mb-2">
            <div>ID</div>
            <div>이름</div>
            <div>전화번호</div>
            <div>포인트</div>
            <div>가입일</div>
            <div>온라인상태</div>
            <div>마지막 로그인</div>
            <div>마지막 로그아웃</div>
            <div>관리</div>
          </div>

          <div className="space-y-0">
            {Array.from({ length: limit }).map((_, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[14%,8%,14%,7%,10%,9%,13%,13%,12%] h-16 px-2 md:px-4 py-2 md:py-4 bg-white border-b border-[#E9E9E9] items-center"
              >
                <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-8 md:w-12 animate-pulse" />
                <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-10 md:w-14 animate-pulse" />
                <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-16 md:w-24 animate-pulse" />
                <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-8 md:w-12 animate-pulse" />
                <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-12 md:w-16 animate-pulse" />
                <div className="h-5 md:h-6 bg-[#E9E9E9] rounded w-10 md:w-14 animate-pulse" />
                <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-14 md:w-20 animate-pulse" />
                <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-14 md:w-20 animate-pulse" />
                <div className="h-6 md:h-7 bg-[#E9E9E9] rounded w-10 md:w-14 animate-pulse" />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-[14%,8%,14%,7%,10%,9%,13%,13%,12%] px-2 md:px-4 py-2 md:py-3 bg-[#F9F9F9] text-xs md:text-sm font-medium text-[#4D4B4E] mb-2">
            <div>ID</div>
            <div>이름</div>
            <div>전화번호</div>
            <div>포인트</div>
            <div>가입일</div>
            <div>온라인상태</div>
            <div>마지막 로그인</div>
            <div>마지막 로그아웃</div>
            <div>관리</div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 md:py-24 lg:py-32">
              <p className="text-sm md:text-base text-[#BFBFBF]">
                {activeTab === "all"
                  ? "아직 회원이 등록되지 않았습니다."
                  : "삭제된 회원이 없습니다."}
              </p>
            </div>
          ) : (
            <div className="space-y-0 flex-1 overflow-y-auto">
              {filteredUsers.map((user, index) => {
                const isOnline = isUserOnline(user);
                
                return (
                  <div
                    key={user.id}
                    className="grid grid-cols-[14%,8%,14%,7%,10%,9%,13%,13%,12%] h-16 px-2 md:px-4 py-2 md:py-4 bg-white border-b border-[#E9E9E9] text-xs md:text-sm text-[#201E22] items-center"
                    data-testid={`user-row-${index}`}
                  >
                    <div className="truncate" title={user.username}>
                      {user.username.length > 16
                        ? `${user.username.substring(0, 16)}...`
                        : user.username}
                    </div>
                    <div className="truncate">{user.name}</div>
                    <div className="truncate">{user.phone || "-"}</div>
                    <div className="text-right sm:text-left">
                      {user.points.toLocaleString()}
                    </div>
                    <div className="truncate">{formatDate(user.createdAt)}</div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isOnline ? "bg-green-600" : "bg-[#BFBFBF]"
                        }`}
                      />
                      <span
                        className={`${
                          isOnline
                            ? "text-green-600"
                            : "text-[#BFBFBF]"
                        }`}
                      >
                        {isOnline ? "온라인" : "오프라인"}
                      </span>
                    </div>
                    <div className="text-xs truncate whitespace-pre-line">
                      {formatDateTimeTwoLines(user.lastLogin)}
                    </div>
                    <div className="text-xs truncate whitespace-pre-line">
                      {formatDateTimeTwoLines(user.lastLogout)}
                    </div>
                    <div>
                      {activeTab === "all" ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openPopup(user.id, user.name, "softDelete")}
                          disabled={deleteMutation.isPending}
                          className="h-7 md:h-8 px-2 md:px-3 text-[10px] md:text-xs whitespace-nowrap"
                          data-testid={`button-delete-${index}`}
                        >
                          회원 삭제
                        </Button>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPopup(user.id, user.name, "restore")}
                            disabled={restoreMutation.isPending}
                            className="h-7 md:h-8 px-2 md:px-3 text-[10px] md:text-xs whitespace-nowrap"
                            data-testid={`button-restore-${index}`}
                          >
                            복구
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openPopup(user.id, user.name, "hardDelete")}
                            disabled={hardDeleteMutation.isPending}
                            className="h-7 md:h-8 px-2 md:px-3 text-[10px] md:text-xs whitespace-nowrap"
                            data-testid={`button-hard-delete-${index}`}
                          >
                            삭제
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(activeTab === "all" ? total : suspendedTotal) > 0 && (
            <AdminPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </>
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
            popupAction === "softDelete"
              ? confirmStep === 1 ? "아니요" : "취소하기"
              : "취소"
          }
          rightButtonText={
            popupAction === "softDelete"
              ? confirmStep === 1 ? "네" : "탈퇴하기"
              : popupAction === "restore" ? "복구" : "삭제"
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
