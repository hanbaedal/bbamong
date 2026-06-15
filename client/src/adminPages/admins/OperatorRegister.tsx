import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminLayout from "../adminLayout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { apiRequest } from "@/lib/adminQueryClient";

export default function OperatorRegisterPage() {
  const { assets } = useAdminAssets();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const ensureMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/operators/ensure", {}),
    onSuccess: () => {
      toast({
        description: "운영자 op1~op5 계정이 준비되었습니다. 리스트에서 비밀번호를 생성하세요.",
      });
      setLocation("/admin/operators/list");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "운영자 계정 준비에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    },
  });

  return (
    <AdminLayout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 mb-3 md:mb-4" data-testid="breadcrumb">
          <span className="text-xs md:text-sm text-[#BFBFBF]">운영자 관리</span>
          <span className="text-xs md:text-sm text-[#BFBFBF]">&gt;</span>
          <span className="text-xs md:text-sm text-[#201E22]">운영자 등록</span>
        </div>

        <h1 className="text-lg md:text-2xl font-semibold text-[#201E22] flex items-center gap-2 mb-4">
          <img src={assets.adMangerListIcon} className="w-7 h-7" alt="" />
          운영자 등록
        </h1>

        <div className="space-y-4 text-sm text-[#4D4B4E] leading-relaxed">
          <p>
            운영자 앱 회원가입은 사용하지 않습니다. 관리자가 발급하는 고정 5개 계정
            (<strong>op1</strong> ~ <strong>op5</strong>)으로 현장 운영합니다.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>비밀번호는 관리자가 <strong>운영자를 선택해 수동 생성</strong>할 때만 발급·갱신됩니다 (8자리).</li>
            <li>
              <strong>경기 관리</strong>에서 오늘 경기를 등록하면, 등록 순서대로 op1~op5에
              자동 할당됩니다.
            </li>
            <li>운영자 리스트에서 아이디·오늘 비밀번호·담당 경기를 확인·복사할 수 있습니다.</li>
          </ul>
        </div>

        <div className="flex gap-2 mt-8">
          <Button
            className="bg-[#E11936] hover:bg-[#B71C1C] text-white"
            onClick={() => ensureMutation.mutate()}
            disabled={ensureMutation.isPending}
            data-testid="button-ensure-operators"
          >
            {ensureMutation.isPending ? "준비 중..." : "운영자 5명 계정 생성"}
          </Button>
          <Button variant="outline" onClick={() => setLocation("/admin/operators/list")}>
            운영자 리스트로 이동
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
