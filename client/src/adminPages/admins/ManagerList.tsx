import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, adminFetch } from "@/lib/adminQueryClient";
import AdminLayout from "../adminLayout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useAdminAssets } from "@/contexts/AdminAssetContext";

interface OperatorAccount {
  id: string;
  username: string;
  name: string;
  assignedMatchNumber: string | null;
  assignedMatchDetail: string | null;
  assignmentLabel: string;
  status: string;
  dailyPasswordPlain: string;
  dailyPasswordDate: string;
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
    mutationFn: async (operatorId: string) =>
      apiRequest("POST", `/api/admin/operators/${operatorId}/rotate-password`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      toast({ description: "비밀번호가 생성되었습니다." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "비밀번호 생성에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    },
  });

  const copyCredentials = async (op: OperatorAccount) => {
    const text = `아이디: ${op.username}\n비밀번호: ${op.dailyPasswordPlain}\n담당 경기: ${op.assignedMatchNumber ?? "없음"}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ description: `${op.username} 로그인 정보를 복사했습니다.` });
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
              경기 등록 순서 1~5 → op1~op5 자동 할당 · 비밀번호는 행별 「생성」 버튼으로 발급
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
          <div className="grid grid-cols-[9%_22%_12%_14%_12%_12%_19%] min-w-[960px] px-2 md:px-4 py-2 md:py-3 bg-[#F5F5F5] border-y border-[#E9E9E9] text-xs md:text-sm font-semibold text-[#201E22]">
            <div>아이디</div>
            <div>경기 할당</div>
            <div>담당 경기</div>
            <div>비밀번호</div>
            <div>상태</div>
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
                className="grid grid-cols-[9%_22%_12%_14%_12%_12%_19%] min-w-[960px] px-2 md:px-4 py-3 bg-white border-b border-[#E9E9E9] items-center text-xs md:text-sm text-[#201E22]"
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
                <div>{op.status}</div>
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
