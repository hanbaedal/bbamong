import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, adminFetch } from "@/lib/adminQueryClient";
import AdminLayout from "../adminLayout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { shareOperatorCredentials } from "@/lib/operatorCredentialsShare";

interface OperatorAccount {
  id: string;
  username: string;
  name: string;
  assignedMatchNumber: string | null;
  assignedMatchDetail: string | null;
  assignmentLabel: string;
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
  // 카톡으로 보낼 링크는 항상 운영 도메인 (앱 딥링크·실서버 로그인)
  return `https://ppamong.com/api/manager/login-link/${encodeURIComponent(token)}`;
}

function buildCopyText(op: OperatorAccount): string {
  const lines = [
    `[빠몽 운영자 로그인] ${op.username}`,
    `담당 경기: ${op.assignedMatchNumber ?? "없음"}`,
    "",
    "▼ 아래 링크를 누르면 운영자 앱에 자동 로그인됩니다 (1회용, 당일까지)",
  ];

  if (op.loginLinkToken) {
    lines.push(buildLoginLinkUrl(op.loginLinkToken));
  } else {
    lines.push("(로그인 링크 없음 — 「생성」을 눌러 새로 발급하세요)");
  }

  return lines.join("\n");
}

function shareTitle(op: OperatorAccount): string {
  return `빠몽 운영자 로그인 (${op.username})`;
}

export default function ManagerListPage() {
  const { assets } = useAdminAssets();
  const { toast } = useToast();

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
  const todayMatches = data?.todayMatches ?? [];

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "활성화" | "비활성화" }) => {
      return apiRequest("PATCH", `/api/admin/operators/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      toast({ description: "운영자 상태가 변경되었습니다." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "상태 변경에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async (operatorId: string) => {
      const res = await apiRequest("POST", `/api/admin/operators/${operatorId}/rotate-password`, {});
      return res.json() as Promise<OperatorsResponse & { loginLinkToken?: string }>;
    },
    onSuccess: async (result, operatorId) => {
      queryClient.setQueryData(["/api/admin/operators"], {
        operators: result.operators,
        todayMatches: result.todayMatches,
      });
      const op = result.operators.find((o) => o.id === operatorId);
      if (op?.loginLinkToken) {
        const shareResult = await shareOperatorCredentials(shareTitle(op), buildCopyText(op));
        if (shareResult === "shared") {
          toast({
            description: "생성 완료. 카카오톡 등 앱에서 받는 사람을 선택해 보내세요.",
          });
          return;
        }
        if (shareResult === "copied") {
          toast({
            description: "생성 후 클립보드에 복사했습니다. 카톡에 붙여넣기 하세요.",
          });
          return;
        }
      }
      toast({ description: "비밀번호와 일회용 로그인 링크가 생성되었습니다. 「카톡 공유」를 눌러 주세요." });
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

  const shareKakaoCredentials = async (op: OperatorAccount) => {
    if (!op.loginLinkToken) {
      toast({ variant: "destructive", description: "먼저 「생성」으로 로그인 링크를 발급하세요." });
      return;
    }
    const shareResult = await shareOperatorCredentials(shareTitle(op), buildCopyText(op));
    if (shareResult === "shared") {
      toast({ description: `${op.username} 로그인 정보 공유 창을 열었습니다. 카카오톡을 선택하세요.` });
      return;
    }
    if (shareResult === "copied") {
      toast({
        description: "공유를 지원하지 않는 환경입니다. 클립보드에 복사했으니 카톡에 붙여넣기 하세요.",
      });
      return;
    }
    toast({ variant: "destructive", description: "공유에 실패했습니다. 「복사」를 이용해 주세요." });
  };

  const copyCredentials = async (op: OperatorAccount) => {
    if (!op.loginLinkToken) {
      toast({ variant: "destructive", description: "먼저 「생성」으로 로그인 링크를 발급하세요." });
      return;
    }
    try {
      await navigator.clipboard.writeText(buildCopyText(op));
      toast({
        description: `${op.username} 자동 로그인 링크를 복사했습니다.`,
      });
    } catch {
      toast({ variant: "destructive", description: "복사에 실패했습니다." });
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 mb-3 md:mb-4 shrink-0" data-testid="breadcrumb">
          <span className="text-xs md:text-sm text-[#BFBFBF]">운영자 관리</span>
          <span className="text-xs md:text-sm text-[#BFBFBF]">&gt;</span>
          <span className="text-xs md:text-sm text-[#201E22]">운영자 리스트</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 shrink-0">
          <div>
            <h1
              className="text-lg md:text-xl lg:text-2xl font-semibold text-[#201E22] flex items-center gap-2"
              data-testid="text-page-title"
            >
              <img src={assets.adListIcon} className="w-6 h-6 md:w-7 md:h-7" alt="" />
              운영자 리스트
            </h1>
            <p className="text-sm text-[#666] mt-1">
              「생성」 후 「카톡 공유」로 바로 보내거나 「복사」로 붙여넣기. 링크 클릭 시 운영자 앱 자동
              로그인. API 동기화 ON인 운영자만 경기 할당·실시간 API 폴링에 포함됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              새로고침
            </Button>
          </div>
        </div>

        {todayMatches.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-[#FFF9FA] border border-[#F5D0D6] text-xs md:text-sm shrink-0">
            <p className="font-semibold text-[#201E22] mb-2">오늘 등록된 경기 (할당 순서)</p>
            <ol className="list-decimal pl-5 space-y-1 text-[#4D4B4E]">
              {todayMatches.map((m, idx) => (
                <li key={m.id}>
                  {m.name} — {m.stadiumName} (
                  {new Date(m.startTime).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })})
                  → <span className="text-[#E11936] font-medium">op{idx + 1}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="overflow-x-auto shrink-0">
          <div className="grid grid-cols-[8%_17%_10%_11%_9%_9%_8%_11%_17%] min-w-[1180px] px-2 md:px-4 py-2 md:py-3 bg-[#F5F5F5] border-y border-[#E9E9E9] text-xs md:text-sm font-semibold text-[#201E22]">
            <div>아이디</div>
            <div>경기 할당</div>
            <div>담당 경기</div>
            <div>비밀번호</div>
            <div>로그인 링크</div>
            <div>상태</div>
            <div>API동기화</div>
            <div>최근 로그인</div>
            <div>관리</div>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="py-16 text-center text-[#BFBFBF]">불러오는 중...</div>
          ) : operators.length === 0 ? (
            <div className="py-16 text-center text-[#BFBFBF]">
              운영자 계정이 없습니다. 운영자 등록 메뉴에서 계정을 생성하세요.
            </div>
          ) : (
            operators.map((op, index) => (
              <div
                key={op.id}
                className="grid grid-cols-[8%_17%_10%_11%_9%_9%_8%_11%_17%] min-w-[1180px] px-2 md:px-4 py-3 bg-white border-b border-[#E9E9E9] items-center text-xs md:text-sm text-[#201E22]"
                data-testid={`manager-row-${index}`}
              >
                <div className="font-medium">{op.username}</div>
                <div className="text-[#666] pr-2" title={op.assignmentLabel}>
                  {op.assignmentLabel}
                </div>
                <div>
                  <div>{op.assignedMatchNumber ?? "—"}</div>
                  {op.assignedMatchDetail && (
                    <div className="text-[10px] text-[#888] mt-0.5">{op.assignedMatchDetail}</div>
                  )}
                </div>
                <div
                  className="font-mono text-[#E11936] font-bold tracking-wider select-all"
                  data-testid={`operator-password-${index}`}
                >
                  {op.dailyPasswordPlain || "—"}
                </div>
                <div className="text-xs">
                  {op.loginLinkActive ? (
                    <span className="text-[#34A853] font-medium">발급됨</span>
                  ) : (
                    <span className="text-[#BFBFBF]">없음</span>
                  )}
                </div>
                <div>{op.status}</div>
                <div>
                  <button
                    type="button"
                    disabled={apiSyncMutation.isPending}
                    onClick={() =>
                      apiSyncMutation.mutate({ id: op.id, enabled: !op.apiSyncEnabled })
                    }
                    className={`px-2 py-1 rounded text-[10px] md:text-xs font-semibold ${
                      op.apiSyncEnabled
                        ? "bg-[#34A853] text-white"
                        : "bg-[#E9E9E9] text-[#666]"
                    } disabled:opacity-50`}
                    data-testid={`operator-api-sync-${index}`}
                  >
                    {op.apiSyncEnabled ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="text-[#666] text-xs">
                  {op.lastLogin ? new Date(op.lastLogin).toLocaleString("ko-KR") : "-"}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => rotateMutation.mutate(op.id)}
                    disabled={rotateMutation.isPending}
                    className="px-2 py-1 text-[10px] md:text-xs font-medium text-white bg-[#E11936] rounded hover:bg-[#C71530] disabled:opacity-50"
                  >
                    생성
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareKakaoCredentials(op)}
                    className="px-2 py-1 text-[10px] md:text-xs font-medium bg-[#FEE500] text-[#3C1E1E] rounded hover:brightness-95"
                    data-testid={`operator-kakao-share-${index}`}
                  >
                    카톡 공유
                  </button>
                  <button
                    type="button"
                    onClick={() => copyCredentials(op)}
                    className="px-2 py-1 text-[10px] md:text-xs font-medium text-white bg-[#4285F4] rounded hover:bg-[#357AE8]"
                  >
                    복사
                  </button>
                  {op.status === "활성화" ? (
                    <button
                      type="button"
                      onClick={() => statusMutation.mutate({ id: op.id, status: "비활성화" })}
                      className="px-2 py-1 text-[10px] md:text-xs font-medium text-white bg-[#E11936] rounded hover:bg-[#C71530]"
                    >
                      비활성화
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => statusMutation.mutate({ id: op.id, status: "활성화" })}
                      className="px-2 py-1 text-[10px] md:text-xs font-medium text-white bg-[#34A853] rounded hover:bg-[#2D8E47]"
                    >
                      활성화
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
