import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest, adminFetch } from "@/lib/adminQueryClient";
import { useLocation } from "wouter";
import AdminLayout from "../adminLayout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useUser } from "@/contexts/UserContext";
import { Eye, EyeOff } from "lucide-react";

interface StaffFormData {
  name: string;
  email: string;
  password: string;
  phone: string;
  department: string;
  position: string;
  notes: string;
}

const emptyForm: StaffFormData = {
  name: "",
  email: "",
  password: "",
  phone: "",
  department: "",
  position: "",
  notes: "",
};

function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-b border-[#E9E9E9] last:border-b-0">
      <th className="w-32 md:w-40 bg-[#FAFAFA] text-left text-sm font-medium text-[#414141] px-4 py-3 align-middle whitespace-nowrap">
        {label}
        {required ? <span className="text-[#E11936] ml-0.5">*</span> : null}
      </th>
      <td className="px-4 py-3">{children}</td>
    </tr>
  );
}

export default function StaffRegisterPage() {
  const { user, isUserLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { assets } = useAdminAssets();
  const { toast } = useToast();
  const [formData, setFormData] = useState<StaffFormData>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);

  const isSuperAdmin = user?.userType === "슈퍼어드민";

  useEffect(() => {
    if (isUserLoaded && !isSuperAdmin) {
      setLocation("/admin/managers");
    }
  }, [isUserLoaded, isSuperAdmin, setLocation]);

  const { data: nextUsernameData, isLoading: isUsernameLoading } = useQuery<{ username: string }>({
    queryKey: ["/api/admin/staff/next-username"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/staff/next-username");
      if (!res.ok) throw new Error("다음 아이디를 불러오지 못했습니다.");
      return res.json();
    },
    enabled: isUserLoaded && isSuperAdmin,
  });

  const nextUsername = nextUsernameData?.username ?? "";

  const createMutation = useMutation({
    mutationFn: async (payload: StaffFormData) => {
      const res = await apiRequest("POST", "/api/admin/staff", {
        name: payload.name,
        email: payload.email,
        password: payload.password,
        phone: payload.phone,
        department: payload.department || null,
        position: payload.position || null,
        notes: payload.notes || null,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "등록에 실패했습니다.");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff/next-username"] });
      setFormData(emptyForm);
      toast({ description: "관리자가 등록되었습니다." });
      setLocation("/admin/staff/list");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "등록에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    },
  });

  if (!isUserLoaded || !isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </AdminLayout>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0 w-full max-w-3xl">
        <div className="flex items-center gap-2 mb-4 shrink-0" data-testid="breadcrumb">
          <span className="text-xs md:text-sm text-[#BFBFBF]">관리자 관리</span>
          <span className="text-xs md:text-sm text-[#BFBFBF]">&gt;</span>
          <span className="text-xs md:text-sm text-[#201E22]">관리자 등록</span>
        </div>

        <div className="flex flex-col items-center mb-8 shrink-0">
          <div className="w-[100px] h-[100px] flex items-center justify-center mb-4">
            <img
              src={assets.adminLogo}
              alt="PPAMONG"
              className="w-full h-full object-contain"
              data-testid="img-staff-register-logo"
            />
          </div>
          <h1 className="text-xl md:text-2xl font-semibold text-[#201E22]" data-testid="text-page-title">
            관리자 등록
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="border border-[#E9E9E9] rounded-lg overflow-hidden bg-white">
            <table className="w-full border-collapse">
              <tbody>
                <FormRow label="아이디" required>
                  <Input
                    value={isUsernameLoading ? "불러오는 중..." : nextUsername}
                    readOnly
                    className="bg-[#FAFAFA] text-[#201E22] font-medium"
                    data-testid="input-username"
                  />
                  <p className="text-[11px] text-[#888] mt-1">ppamong.01 형식으로 자동 부여됩니다.</p>
                </FormRow>

                <FormRow label="비밀번호" required>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="pr-10"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888] hover:text-[#414141]"
                      aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormRow>

                <FormRow label="이름" required>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="input-name"
                  />
                </FormRow>

                <FormRow label="전화번호" required>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="01012345678"
                    required
                    data-testid="input-phone"
                  />
                </FormRow>

                <FormRow label="이메일" required>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    data-testid="input-email"
                  />
                </FormRow>

                <FormRow label="부서">
                  <Input
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    data-testid="input-department"
                  />
                </FormRow>

                <FormRow label="직책">
                  <Input
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    data-testid="input-position"
                  />
                </FormRow>

                <FormRow label="참고">
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="resize-none"
                    data-testid="input-notes"
                  />
                </FormRow>
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 justify-center mt-8 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/admin/staff/list")}
              data-testid="button-cancel"
            >
              취소
            </Button>
            <Button
              type="submit"
              className="bg-[#E11936] hover:bg-[#B71C1C] text-white min-w-[88px]"
              disabled={createMutation.isPending || isUsernameLoading || !nextUsername}
              data-testid="button-submit"
            >
              {createMutation.isPending ? "등록 중..." : "등록"}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
