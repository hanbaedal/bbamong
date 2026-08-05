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
import { Eye, EyeOff, UserRound } from "lucide-react";

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

function Field({
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
      <Label className="text-xs text-[#666] mb-1 block">
        {label}
        {required ? <span className="text-[#E11936] ml-0.5">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#E9E9E9] bg-white overflow-hidden">
      <div className="px-4 py-2 border-b border-[#F0F0F0] bg-[#FAFAFA]">
        <h2 className="text-sm font-semibold text-[#201E22]">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

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

  const displayName = formData.name.trim() || "이름 미입력";

  return (
    <AdminLayout>
      <AdminPageShell title="관리자 등록" description="슈퍼어드민 전용 · ppamong.XX 아이디 자동 부여">
        <form onSubmit={handleSubmit} className="max-w-4xl">
          <div className="mb-4 rounded-lg border border-[#E9E9E9] bg-white px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF5F6] text-[#E11936]">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-[#201E22] truncate" data-testid="preview-name">
                {displayName}
              </p>
              <p className="text-xs text-[#888] mt-0.5">
                아이디{" "}
                <span className="font-medium text-[#201E22]" data-testid="input-username">
                  {isUsernameLoading ? "불러오는 중..." : nextUsername || "—"}
                </span>
                {formData.department || formData.position ? (
                  <span className="text-[#AAA]">
                    {" "}
                    · {[formData.department, formData.position].filter(Boolean).join(" / ")}
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <FormSection title="기본 정보">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="이름" required className="sm:col-span-2">
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoFocus
                    placeholder="실명 입력"
                    className="h-9 text-sm"
                    data-testid="input-name"
                  />
                </Field>
                <Field label="전화번호" required>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="01012345678"
                    required
                    inputMode="tel"
                    className="h-9 text-sm"
                    data-testid="input-phone"
                  />
                </Field>
                <Field label="이메일" required>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="h-9 text-sm"
                    data-testid="input-email"
                  />
                </Field>
                <Field label="부서">
                  <Input
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="h-9 text-sm"
                    data-testid="input-department"
                  />
                </Field>
                <Field label="직책">
                  <Input
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="h-9 text-sm"
                    data-testid="input-position"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="계정">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="아이디" required>
                  <Input
                    value={isUsernameLoading ? "불러오는 중..." : nextUsername}
                    readOnly
                    className="h-9 text-sm bg-[#FAFAFA] font-medium"
                    data-testid="input-username-field"
                  />
                  <p className="text-[10px] text-[#888] mt-1">ppamong.01 형식 자동 부여</p>
                </Field>
                <Field label="비밀번호" required>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="h-9 pr-9 text-sm"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888] hover:text-[#414141] p-0.5"
                      aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
              </div>
            </FormSection>

            <FormSection title="참고">
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="메모 (선택)"
                className="resize-none min-h-[56px] text-sm"
                data-testid="input-notes"
              />
            </FormSection>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end mt-5">
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => setLocation("/admin/staff/list")}
              data-testid="button-cancel"
            >
              취소
            </Button>
            <Button
              type="submit"
              className="h-9 bg-[#E11936] hover:bg-[#B71C1C] text-white min-w-[88px]"
              disabled={createMutation.isPending || isUsernameLoading || !nextUsername}
              data-testid="button-submit"
            >
              {createMutation.isPending ? "등록 중..." : "등록"}
            </Button>
          </div>
        </form>
      </AdminPageShell>
    </AdminLayout>
  );
}
