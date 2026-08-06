import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest, adminFetch } from "@/lib/adminQueryClient";
import { useLocation } from "wouter";
import AdminLayout from "../adminLayout";
import AdminPageShell from "../components/AdminPageShell";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

function CompactField({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-[11px] text-[#888] mb-0.5 block leading-tight">
        {label}
        {required ? <span className="text-[#E11936] ml-0.5">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

const inputClass = "h-8 text-xs";

export default function StaffRegisterPage() {
  const { user, isUserLoaded } = useUser();
  const [, setLocation] = useLocation();
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
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">로딩 중...</div>
      </AdminLayout>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <AdminLayout>
      <AdminPageShell title="관리자 등록">
        <form onSubmit={handleSubmit} className="max-w-3xl">
          <div className="rounded-lg border border-[#E9E9E9] bg-white p-3 sm:p-4">
            <p className="text-[11px] text-[#888] mb-3 pb-2 border-b border-[#F0F0F0]">
              슈퍼어드민 전용 · 빠몽 관리자 (
              <span className="font-medium text-[#201E22]" data-testid="input-username">
                {isUsernameLoading ? "…" : nextUsername || "—"}
              </span>
              ) 자동 부여
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2">
              <CompactField label="이름" required className="col-span-2 md:col-span-1">
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                  placeholder="실명"
                  className={inputClass}
                  data-testid="input-name"
                />
              </CompactField>
              <CompactField label="전화번호" required>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="01012345678"
                  required
                  inputMode="tel"
                  className={inputClass}
                  data-testid="input-phone"
                />
              </CompactField>
              <CompactField label="이메일" required>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className={inputClass}
                  data-testid="input-email"
                />
              </CompactField>
              <CompactField label="부서">
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className={inputClass}
                  data-testid="input-department"
                />
              </CompactField>
              <CompactField label="직책">
                <Input
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className={inputClass}
                  data-testid="input-position"
                />
              </CompactField>
              <CompactField label="아이디" required>
                <Input
                  value={isUsernameLoading ? "불러오는 중…" : nextUsername}
                  readOnly
                  className={`${inputClass} bg-[#FAFAFA] font-medium`}
                  data-testid="input-username-field"
                />
              </CompactField>
              <CompactField label="비밀번호" required>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={`${inputClass} pr-8`}
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#888] hover:text-[#414141] p-0.5"
                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </CompactField>
              <CompactField label="메모" className="col-span-2 md:col-span-3">
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={1}
                  placeholder="선택"
                  className="resize-none min-h-[32px] text-xs py-1.5"
                  data-testid="input-notes"
                />
              </CompactField>
            </div>

            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-[#F0F0F0]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setLocation("/admin/staff/list")}
                data-testid="button-cancel"
              >
                취소
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs bg-[#E11936] hover:bg-[#B71C1C] text-white min-w-[72px]"
                disabled={createMutation.isPending || isUsernameLoading || !nextUsername}
                data-testid="button-submit"
              >
                {createMutation.isPending ? "등록 중…" : "등록"}
              </Button>
            </div>
          </div>
        </form>
      </AdminPageShell>
    </AdminLayout>
  );
}
