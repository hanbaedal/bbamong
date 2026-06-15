import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/adminQueryClient";
import { useLocation } from "wouter";
import AdminLayout from "../adminLayout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useUser } from "@/contexts/UserContext";

interface StaffFormData {
  username: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  department: string;
  position: string;
}

const emptyForm: StaffFormData = {
  username: "",
  name: "",
  email: "",
  password: "",
  phone: "",
  department: "",
  position: "",
};

export default function StaffRegisterPage() {
  const { user, isUserLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { assets } = useAdminAssets();
  const { toast } = useToast();
  const [formData, setFormData] = useState<StaffFormData>(emptyForm);

  const isSuperAdmin = user?.userType === "슈퍼어드민";

  useEffect(() => {
    if (isUserLoaded && !isSuperAdmin) {
      setLocation("/admin/managers");
    }
  }, [isUserLoaded, isSuperAdmin, setLocation]);

  const createMutation = useMutation({
    mutationFn: async (payload: StaffFormData) => {
      return await apiRequest("POST", "/api/admin/staff", {
        username: payload.username,
        name: payload.name,
        email: payload.email,
        password: payload.password,
        phone: payload.phone,
        department: payload.department || null,
        position: payload.position || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
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
      <div className="flex flex-col h-full min-h-0 max-w-xl">
        <div className="flex items-center gap-2 mb-3 md:mb-4 shrink-0" data-testid="breadcrumb">
          <span className="text-xs md:text-sm text-[#BFBFBF]">관리자 관리</span>
          <span className="text-xs md:text-sm text-[#BFBFBF]">&gt;</span>
          <span className="text-xs md:text-sm text-[#201E22]">관리자 등록</span>
        </div>

        <h1
          className="text-lg md:text-xl lg:text-2xl font-semibold text-[#201E22] flex items-center gap-2 mb-6 shrink-0"
          data-testid="text-page-title"
        >
          <img src={assets.adEmployeeIcon} className="w-6 h-6 md:w-7 md:h-7" alt="" />
          관리자 등록
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>아이디</Label>
            <Input
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="로그인 아이디"
              required
              data-testid="input-username"
            />
          </div>
          <div className="space-y-2">
            <Label>이름</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="input-name"
            />
          </div>
          <div className="space-y-2">
            <Label>이메일</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              data-testid="input-email"
            />
          </div>
          <div className="space-y-2">
            <Label>비밀번호</Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
              data-testid="input-password"
            />
          </div>
          <div className="space-y-2">
            <Label>전화번호</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              data-testid="input-phone"
            />
          </div>
          <div className="space-y-2">
            <Label>부서</Label>
            <Input
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              data-testid="input-department"
            />
          </div>
          <div className="space-y-2">
            <Label>직책</Label>
            <Input
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              data-testid="input-position"
            />
          </div>

          <div className="flex gap-2 pt-4">
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
              className="bg-[#E11936] hover:bg-[#B71C1C] text-white"
              disabled={createMutation.isPending}
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
