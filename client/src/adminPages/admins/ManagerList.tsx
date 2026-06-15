import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, adminFetch } from "@/lib/adminQueryClient";
import AdminLayout from "../adminLayout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { getKstDateKey } from "@/lib/kstDate";

interface OperatorAccount {
  id: string;
  username: string;
  name: string;
  assignedMatchNumber: string | null;
  status: string;
  dailyPasswordPlain: string;
  dailyPasswordDate: string;
  lastLogin: string | null;
  operatorSlot: number;
}

interface OperatorsResponse {
  operators: OperatorAccount[];
}

export default function ManagerListPage() {
  const { assets } = useAdminAssets();
  const { toast } = useToast();
  const todayLabel = getKstDateKey();

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
    mutationFn: async () => apiRequest("POST", "/api/admin/operators/rotate-passwords", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      toast({ description: "오늘 비밀번호가 재발급되었습니다." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "비밀번호 재발급에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/operators/sync-matches", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      toast({ description: "DB 경기 순서로 할당을 동기화했습니다." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "동기화에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    },
  });

  const copyCredentials = async (op: OperatorAccount) => {
    const text = `아이디: ${op.username}\n비밀번호: ${op.dailyPasswordPlain}\n담당: ${op.assignedMatchNumber ?? "-"}`;
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
              고정 5명(op1~op5) · DB 경기 시작순 자동 할당 · 비밀번호 매일 자동 변경 ({todayLabel})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              경기 할당 동기화
            </Button>
            <Button
              size="sm"
              className="bg-[#E11936] hover:bg-[#B71C1C] text-white"
              onClick={() => rotateMutation.mutate()}
              disabled={rotateMutation.isPending}
            >
              오늘 비밀번호 재발급
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              새로고침
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto shrink-0">
          <div className="grid grid-cols-[10%_14%_12%_18%_12%_14%_20%] min-w-[880px] px-2 md:px-4 py-2 md:py-3 bg-[#F5F5F5] border-y border-[#E9E9E9] text-xs md:text-sm font-semibold text-[#201E22]">
            <div>아이디</div>
            <div>담당 경기</div>
            <div>이름</div>
            <div>오늘 비밀번호</div>
            <div>상태</div>
            <div>최근 로그인</div>
            <div>관리</div>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="py-16 text-center text-[#BFBFBF]">불러오는 중...</div>
          ) : operators.length === 0 ? (
            <div className="py-16 text-center text-[#BFBFBF]">운영자 계정을 준비 중입니다.</div>
          ) : (
            operators.map((op, index) => (
              <div
                key={op.id}
                className="grid grid-cols-[10%_14%_12%_18%_12%_14%_20%] min-w-[880px] px-2 md:px-4 py-3 bg-white border-b border-[#E9E9E9] items-center text-xs md:text-sm text-[#201E22]"
                data-testid={`manager-row-${index}`}
              >
                <div className="font-medium">{op.username}</div>
                <div>{op.assignedMatchNumber ?? "-"}</div>
                <div className="truncate" title={op.name}>
                  {op.name}
                </div>
                <div
                  className="font-mono text-[#E11936] font-bold tracking-wider select-all"
                  data-testid={`operator-password-${index}`}
                  title="운영자에게 전달할 오늘 비밀번호"
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
                      data-testid={`button-deactivate-${index}`}
                    >
                      비활성화
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => statusMutation.mutate({ id: op.id, status: "활성화" })}
                      className="px-2 py-1 text-[10px] md:text-xs font-medium text-white bg-[#34A853] rounded hover:bg-[#2D8E47]"
                      data-testid={`button-activate-${index}`}
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
