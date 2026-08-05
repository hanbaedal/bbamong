import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { queryClient, apiRequest, adminFetch } from "@/lib/adminQueryClient";
import AdminLayout from "../adminLayout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  buildLoginLinkQrImageUrl,
  canUseNativeShare,
  copyOperatorCredentials,
} from "@/lib/operatorCredentialsShare";
import {
  operatorAccountStatusClass,
  operatorMatchPhaseBadgeClass,
  type OperatorMatchPhase,
} from "@shared/operatorMatchStatus";

interface OperatorAccount {
  id: string;
  username: string;
  name: string;
  assignedMatchNumber: string | null;
  assignedMatchStatusLabel: OperatorMatchPhase | null;
  assignedMatchDetail: string | null;
  status: string;
  apiSyncEnabled: boolean;
  dailyPasswordPlain: string;
  dailyPasswordDate: string;
  loginLinkToken: string;
  loginLinkActive: boolean;
  lastLogin: string | null;
  operatorSlot: number;
}

interface OperatorsResponse {
  operators: OperatorAccount[];
  todayMatches: unknown[];
}

const OPERATOR_ROW_TINT: Record<number, string> = {
  1: "bg-[#FFF5F8] hover:bg-[#FFECF2]",
  2: "bg-[#F0F7FF] hover:bg-[#E3F0FF]",
  3: "bg-[#F1F8F4] hover:bg-[#E5F3EA]",
  4: "bg-[#FFF8F0] hover:bg-[#FFF0E3]",
  5: "bg-[#F5F3FF] hover:bg-[#EBE7FF]",
};

function operatorRowTint(slot: number): string {
  return OPERATOR_ROW_TINT[slot] ?? "bg-white hover:bg-[#FAFAFA]";
}

function accountStatusBadgeClass(status: string): string {
  return status === "활성화"
    ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]"
    : "bg-[#F5F5F5] text-[#9E9E9E] border border-[#EEEEEE]";
}

function linkStatusBadgeClass(active: boolean): string {
  return active
    ? "bg-[#E8F5E9] text-[#388E3C] border border-[#C8E6C9]"
    : "bg-[#F5F5F5] text-[#BDBDBD] border border-[#EEEEEE]";
}

function buildLoginLinkUrl(token: string): string {
  return `https://ppamong.com/api/manager/login-link/${encodeURIComponent(token)}`;
}

function buildCopyText(op: OperatorAccount): string {
  const lines = [
    `[빠몽 운영자 로그인] ${op.username}`,
    `담당 경기: ${op.assignedMatchNumber ?? "없음"}`,
    `비밀번호: ${op.dailyPasswordPlain || "(생성 버튼으로 발급)"}`,
    "",
    "▼ 아래 링크를 누르면 운영자 앱에 자동 로그인됩니다 (경기 종료 전까지 사용 가능)",
  ];

  if (op.loginLinkToken) {
    lines.push(buildLoginLinkUrl(op.loginLinkToken));
  } else {
    lines.push("(로그인 링크 없음 — 「생성」을 눌러 새로 발급하세요)");
  }

  return lines.join("\n");
}

function operatorWithToken(op: OperatorAccount, tokenOverride?: string): OperatorAccount | null {
  const token = (tokenOverride ?? op.loginLinkToken).trim();
  if (!token) return null;
  return { ...op, loginLinkToken: token, loginLinkActive: true };
}

export default function ManagerListPage() {
  const { toast } = useToast();
  const showQrButton = useMemo(() => !canUseNativeShare(), []);
  const [qrModal, setQrModal] = useState<{
    username: string;
    loginLinkUrl: string;
  } | null>(null);

  const { data, isLoading, refetch } = useQuery<OperatorsResponse>({
    queryKey: ["/api/admin/operators"],
    queryFn: async () => {
      const response = await adminFetch("/api/admin/operators");
      if (!response.ok) throw new Error("Failed to fetch operators");
      return response.json();
    },
    refetchOnMount: true,
    refetchInterval: 60_000,
  });

  const operators = data?.operators ?? [];

  const rotateMutation = useMutation({
    mutationFn: async (operatorId: string) => {
      const res = await apiRequest("POST", `/api/admin/operators/${operatorId}/rotate-password`, {});
      return res.json() as Promise<OperatorsResponse & { loginLinkToken?: string }>;
    },
    onSuccess: async (result, operatorId) => {
      const freshToken = result.loginLinkToken?.trim() ?? "";
      const op = result.operators.find((o) => o.id === operatorId);
      const canUseLink = Boolean(op && freshToken && op.status === "활성화");

      const operators =
        op && freshToken && canUseLink
          ? result.operators.map((row) =>
              row.id === operatorId
                ? { ...row, loginLinkToken: freshToken, loginLinkActive: true }
                : row,
            )
          : result.operators;

      queryClient.setQueryData(["/api/admin/operators"], {
        operators,
        todayMatches: result.todayMatches,
      });

      const opForCopy = canUseLink && op ? operatorWithToken(op, freshToken) : null;
      if (opForCopy) {
        const copied = await copyOperatorCredentials(buildCopyText(opForCopy));
        if (copied) {
          toast({ description: "생성 완료. 클립보드에 복사했습니다." });
          return;
        }
      }
      toast({
        description: showQrButton
          ? "로그인 링크가 생성되었습니다. 「복사」 또는 「QR」을 이용하세요."
          : "로그인 링크가 생성되었습니다. 「복사」를 이용하세요.",
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "비밀번호 생성에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    },
  });

  const apiSyncMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/operators/${id}/api-sync`, { enabled });
      return res.json() as Promise<OperatorsResponse & { message?: string }>;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["/api/admin/operators"], {
        operators: result.operators,
        todayMatches: result.todayMatches,
      });
      toast({ description: result.message ?? "API 동기화 설정이 변경되었습니다." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "동기화 설정 변경에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    },
  });

  const copyCredentials = async (op: OperatorAccount) => {
    const opForShare = operatorWithToken(op);
    if (!opForShare) {
      toast({ variant: "destructive", description: "먼저 「생성」으로 로그인 링크를 발급하세요." });
      return;
    }
    const ok = await copyOperatorCredentials(buildCopyText(opForShare));
    if (ok) {
      toast({ description: `${op.username} 로그인 정보를 복사했습니다.` });
      return;
    }
    toast({ variant: "destructive", description: "복사에 실패했습니다." });
  };

  const openQrModal = (op: OperatorAccount) => {
    if (!op.loginLinkToken) {
      toast({ variant: "destructive", description: "먼저 「생성」으로 로그인 링크를 발급하세요." });
      return;
    }
    setQrModal({
      username: op.username,
      loginLinkUrl: buildLoginLinkUrl(op.loginLinkToken),
    });
  };

  const renderActionButtons = (op: OperatorAccount, index: number) => (
    <div className="flex flex-nowrap items-center gap-1">
      <button
        type="button"
        onClick={() => rotateMutation.mutate(op.id)}
        disabled={rotateMutation.isPending}
        className="px-2 py-0.5 text-[11px] font-medium text-white bg-[#E57373] rounded hover:bg-[#EF5350] disabled:opacity-50 whitespace-nowrap shadow-sm"
      >
        생성
      </button>
      <button
        type="button"
        onClick={() => void copyCredentials(op)}
        disabled={!op.loginLinkToken}
        className="px-2 py-0.5 text-[11px] font-medium text-[#1565C0] bg-[#E3F2FD] border border-[#BBDEFB] rounded hover:bg-[#BBDEFB]/40 disabled:opacity-40 whitespace-nowrap"
      >
        복사
      </button>
      {showQrButton && (
        <button
          type="button"
          onClick={() => openQrModal(op)}
          disabled={!op.loginLinkToken}
          className="px-2 py-0.5 text-[11px] font-medium text-[#5D4037] bg-[#FFF3E0] border border-[#FFE0B2] rounded hover:bg-[#FFE0B2]/60 disabled:opacity-40 whitespace-nowrap"
          data-testid={`operator-qr-${index}`}
        >
          QR
        </button>
      )}
      <label
        className="inline-flex items-center gap-1 ml-0.5 text-[10px] text-[#666] cursor-pointer whitespace-nowrap shrink-0"
        data-testid={`operator-api-sync-${index}`}
      >
        <Switch
          checked={op.apiSyncEnabled}
          disabled={apiSyncMutation.isPending}
          onCheckedChange={(enabled) => apiSyncMutation.mutate({ id: op.id, enabled })}
          className="scale-[0.72] data-[state=checked]:bg-[#81C784]"
        />
        <span className="tabular-nums">API {op.apiSyncEnabled ? "ON" : "OFF"}</span>
      </label>
    </div>
  );

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0 -mx-3 sm:-mx-4 md:-mx-5 lg:-mx-6 xl:-mx-8">
        <div className="flex justify-end mb-2 shrink-0 px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => refetch()}>
            새로고침
          </Button>
        </div>

        <div className="flex-1 overflow-auto min-h-0 w-full">
          {isLoading ? (
            <div className="border-y border-[#E8E4F3] bg-[#FAFAFA] py-10 text-center text-sm text-[#888]">
              불러오는 중...
            </div>
          ) : operators.length === 0 ? (
            <div className="mx-3 sm:mx-4 rounded-lg border border-dashed border-[#E0E0E0] bg-[#FAFAFA] p-12 text-center">
              <p className="text-sm text-[#888]">
                운영자 계정이 없습니다. 운영자 등록 메뉴에서 계정을 생성하세요.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border-y border-[#E8E4F3] w-full">
              <table className="w-full text-xs sm:text-sm min-w-[960px] border-collapse">
                <thead>
                  <tr className="bg-[#F3F0FF] border-b border-[#E8E4F3] text-left text-[11px] sm:text-xs text-[#6B5B95]">
                    <th className="px-2.5 py-2 font-semibold whitespace-nowrap">운영자</th>
                    <th className="px-2.5 py-2 font-semibold whitespace-nowrap min-w-[160px]">담당경기</th>
                    <th className="px-2.5 py-2 font-semibold whitespace-nowrap min-w-[130px]">경기시간</th>
                    <th className="px-2.5 py-2 font-semibold whitespace-nowrap text-center">경기</th>
                    <th className="px-2.5 py-2 font-semibold whitespace-nowrap text-center">링크</th>
                    <th className="px-2.5 py-2 font-semibold whitespace-nowrap text-center">계정</th>
                    <th className="px-2.5 py-2 font-semibold whitespace-nowrap min-w-[120px]">최근로그인</th>
                    <th className="px-2.5 py-2 font-semibold whitespace-nowrap">비밀번호</th>
                    <th className="px-2.5 py-2 font-semibold whitespace-nowrap min-w-[220px]">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((op, index) => (
                    <tr
                      key={op.id}
                      className={`border-b border-[#EDE9F6]/80 transition-colors align-middle ${operatorRowTint(op.operatorSlot)}`}
                      data-testid={`manager-row-${index}`}
                    >
                      <td className="px-2.5 py-2 font-bold text-[#201E22] whitespace-nowrap">
                        {op.username}
                      </td>
                      <td className="px-2.5 py-2 text-[#201E22] whitespace-nowrap">
                        <span className="font-medium" title={op.assignedMatchNumber ?? undefined}>
                          {op.assignedMatchNumber ?? "—"}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-[#666] tabular-nums whitespace-nowrap">
                        {op.assignedMatchDetail && op.assignedMatchDetail !== "(오늘 경기 없음)"
                          ? op.assignedMatchDetail
                          : "—"}
                      </td>
                      <td className="px-2.5 py-2 text-center whitespace-nowrap">
                        {op.assignedMatchStatusLabel ? (
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${operatorMatchPhaseBadgeClass(op.assignedMatchStatusLabel)}`}
                          >
                            {op.assignedMatchStatusLabel}
                          </span>
                        ) : (
                          <span className="text-[#BDBDBD]">—</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${linkStatusBadgeClass(op.loginLinkActive)}`}
                        >
                          {op.loginLinkActive ? "발급" : "없음"}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${accountStatusBadgeClass(op.status)} ${operatorAccountStatusClass(op.status)}`}
                        >
                          {op.status}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-[#666] tabular-nums whitespace-nowrap text-[11px]">
                        {op.lastLogin ? new Date(op.lastLogin).toLocaleString("ko-KR") : "—"}
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <span
                          className="inline-block font-mono text-xs font-bold text-[#C62828] bg-[#FFF5F6] border border-[#FFCDD2] rounded px-1.5 py-0.5 tracking-wide select-all"
                          data-testid={`operator-password-${index}`}
                        >
                          {op.dailyPasswordPlain || "—"}
                        </span>
                      </td>
                      <td className="px-2.5 py-2">{renderActionButtons(op, index)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {qrModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setQrModal(null)}
          data-testid="modal-operator-login-qr"
        >
          <div
            className="bg-white rounded-[12px] w-full max-w-[360px] p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[#201E22] mb-1">{qrModal.username} 로그인 QR</h2>
            <p className="text-xs text-[#666] mb-4">
              폰 카메라로 스캔하거나, QR 이미지를 카톡으로 보내 주세요.
            </p>
            <img
              src={buildLoginLinkQrImageUrl(qrModal.loginLinkUrl)}
              alt="운영자 로그인 QR"
              className="mx-auto w-[240px] h-[240px] border border-[#E9E9E9] rounded-lg"
            />
            <p className="mt-3 text-[10px] text-[#888] break-all">{qrModal.loginLinkUrl}</p>
            <div className="mt-4 flex gap-2 justify-center">
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-md bg-[#4285F4] text-white"
                onClick={() => {
                  void copyOperatorCredentials(qrModal.loginLinkUrl).then((ok) => {
                    if (ok) toast({ description: "링크를 복사했습니다." });
                  });
                }}
              >
                링크 복사
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-md border border-[#E9E9E9]"
                onClick={() => setQrModal(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
