import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { queryClient, apiRequest, adminFetch } from "@/lib/adminQueryClient";
import AdminLayout from "../adminLayout";
import { adminPageContentClass, adminTableClass, adminTableWrapClass } from "../components/adminPageStyles";
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

interface TodayMatch {
  id: string;
  name: string;
  startTime: string;
  stadiumName: string;
  registrationOrder: number;
}

interface OperatorsResponse {
  operators: OperatorAccount[];
  todayMatches: TodayMatch[];
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
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => rotateMutation.mutate(op.id)}
          disabled={rotateMutation.isPending}
          className="px-2 py-0.5 text-[11px] font-medium text-white bg-[#E11936] rounded hover:bg-[#C71530] disabled:opacity-50 whitespace-nowrap"
        >
          생성
        </button>
        <button
          type="button"
          onClick={() => void copyCredentials(op)}
          disabled={!op.loginLinkToken}
          className="px-2 py-0.5 text-[11px] font-medium text-[#4285F4] border border-[#4285F4]/40 rounded hover:bg-[#F0F7FF] disabled:opacity-40 whitespace-nowrap"
        >
          복사
        </button>
        {showQrButton && (
          <button
            type="button"
            onClick={() => openQrModal(op)}
            disabled={!op.loginLinkToken}
            className="px-2 py-0.5 text-[11px] font-medium text-[#201E22] bg-[#E9E9E9] rounded hover:bg-[#D8D8D8] disabled:opacity-40 whitespace-nowrap"
            data-testid={`operator-qr-${index}`}
          >
            QR
          </button>
        )}
      </div>
      <label
        className="inline-flex items-center gap-1.5 text-[10px] text-[#666] cursor-pointer whitespace-nowrap"
        data-testid={`operator-api-sync-${index}`}
      >
        <Switch
          checked={op.apiSyncEnabled}
          disabled={apiSyncMutation.isPending}
          onCheckedChange={(enabled) => apiSyncMutation.mutate({ id: op.id, enabled })}
          className="scale-75 origin-left data-[state=checked]:bg-[#34A853]"
        />
        API {op.apiSyncEnabled ? "ON" : "OFF"}
      </label>
    </div>
  );

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex justify-end mb-3 shrink-0">
          <Button variant="outline" size="sm" className="h-9" onClick={() => refetch()}>
            새로고침
          </Button>
        </div>
        <div className={adminPageContentClass}>
        {isLoading ? (
          <div className={`${adminTableWrapClass} bg-white`}>
            <div className="p-8 text-center text-sm text-[#888]">불러오는 중...</div>
          </div>
        ) : operators.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E0E0E0] bg-[#FAFAFA] p-12 text-center">
            <p className="text-sm text-[#888]">운영자 계정이 없습니다. 운영자 등록 메뉴에서 계정을 생성하세요.</p>
          </div>
        ) : (
          <>
            <div className={`hidden md:block ${adminTableWrapClass}`}>
              <table className={`${adminTableClass} min-w-[820px] table-fixed`}>
                <colgroup>
                  <col className="w-[72px]" />
                  <col className="w-[22%]" />
                  <col className="w-[88px]" />
                  <col className="w-[72px]" />
                  <col className="w-[72px]" />
                  <col className="w-[140px]" />
                  <col />
                </colgroup>
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#E9E9E9] text-left text-xs text-[#888]">
                    <th className="px-3 py-2.5 font-medium">아이디</th>
                    <th className="px-3 py-2.5 font-medium">담당 경기</th>
                    <th className="px-3 py-2.5 font-medium">비밀번호</th>
                    <th className="px-3 py-2.5 font-medium text-center">링크</th>
                    <th className="px-3 py-2.5 font-medium text-center">상태</th>
                    <th className="px-3 py-2.5 font-medium">최근 로그인</th>
                    <th className="px-3 py-2.5 font-medium">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((op, index) => (
                    <tr
                      key={op.id}
                      className="border-b border-[#F0F0F0] bg-white hover:bg-[#FFFBFB] transition-colors align-top"
                      data-testid={`manager-row-${index}`}
                    >
                      <td className="px-3 py-2.5 font-semibold text-[#201E22]">{op.username}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-[#201E22] leading-snug truncate" title={op.assignedMatchNumber ?? undefined}>
                          {op.assignedMatchNumber ?? "—"}
                        </p>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {op.assignedMatchStatusLabel && (
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${operatorMatchPhaseBadgeClass(op.assignedMatchStatusLabel)}`}
                            >
                              {op.assignedMatchStatusLabel}
                            </span>
                          )}
                          {op.assignedMatchDetail && (
                            <span className="text-[10px] text-[#888] truncate" title={op.assignedMatchDetail}>
                              {op.assignedMatchDetail}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="px-3 py-2.5 font-mono text-sm text-[#E11936] font-bold tracking-wide select-all"
                        data-testid={`operator-password-${index}`}
                      >
                        {op.dailyPasswordPlain || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs">
                        {op.loginLinkActive ? (
                          <span className="text-[#34A853] font-medium">발급</span>
                        ) : (
                          <span className="text-[#BFBFBF]">없음</span>
                        )}
                      </td>
                      <td className={`px-3 py-2.5 text-center text-xs ${operatorAccountStatusClass(op.status)}`}>
                        {op.status}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#666] tabular-nums whitespace-nowrap">
                        {op.lastLogin ? new Date(op.lastLogin).toLocaleString("ko-KR") : "—"}
                      </td>
                      <td className="px-3 py-2.5">{renderActionButtons(op, index)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {operators.map((op, index) => (
                <article
                  key={op.id}
                  className="rounded-lg border border-[#E9E9E9] bg-white p-4"
                  data-testid={`manager-card-${index}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-[#201E22]">{op.username}</p>
                      <p className={`text-xs mt-0.5 ${operatorAccountStatusClass(op.status)}`}>{op.status}</p>
                    </div>
                    <span className="font-mono text-sm text-[#E11936] font-bold">{op.dailyPasswordPlain || "—"}</span>
                  </div>
                  <dl className="grid grid-cols-[72px_1fr] gap-y-1 text-xs text-[#666] mb-3">
                    <dt>담당 경기</dt>
                    <dd className="text-[#201E22]">
                      {op.assignedMatchNumber ?? "—"}
                      {op.assignedMatchStatusLabel && (
                        <span
                          className={`ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${operatorMatchPhaseBadgeClass(op.assignedMatchStatusLabel)}`}
                        >
                          {op.assignedMatchStatusLabel}
                        </span>
                      )}
                    </dd>
                    <dt>로그인 링크</dt>
                    <dd>{op.loginLinkActive ? "발급됨" : "없음"}</dd>
                    <dt>최근 로그인</dt>
                    <dd>{op.lastLogin ? new Date(op.lastLogin).toLocaleString("ko-KR") : "—"}</dd>
                  </dl>
                  {renderActionButtons(op, index)}
                </article>
              ))}
            </div>
          </>
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
