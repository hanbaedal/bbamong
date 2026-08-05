import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, adminFetch } from "@/lib/adminQueryClient";
import { useLocation } from "wouter";
import AdminLayout from "../adminLayout";
import type { AdminUser } from "@shared/schema";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";
import debounce from "lodash.debounce";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/contexts/UserContext";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";
import { Plus, Trash2, UserRound } from "lucide-react";
import type { OpsPlatform } from "../ops/opsLoginStatusUi";
import {
  AdminCompactListPage,
  AdminCompactTable,
  AdminCompactTableShell,
  adminCompactTdClass,
  adminCompactThClass,
  adminCompactTheadRowClass,
  adminCompactTrClass,
} from "../components/adminCompactListUi";

type AdminUserWithoutPassword = Omit<AdminUser, "password"> & {
  passwordPlain?: string;
};

interface StaffFormData {
  username: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  department: string;
  position: string;
  status: "활성화" | "비활성화";
}

const emptyForm: StaffFormData = {
  username: "",
  name: "",
  email: "",
  password: "",
  phone: "",
  department: "",
  position: "",
  status: "활성화",
};

interface StaffListResponse {
  admins: AdminUserWithoutPassword[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  approvedCount: number;
  platform: OpsPlatform;
  counts: { ppamong: number; badminton9: number };
}

function StaffStatusBadge({ status }: { status: string | null | undefined }) {
  const active = status !== "비활성화";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        active ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-[#F5F5F5] text-[#888]"
      }`}
    >
      {active ? "활성" : "비활성"}
    </span>
  );
}

function FormField({
  label,
  required,
  hint,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-[#666] mb-1 block">
        {label}
        {required ? <span className="text-[#E11936] ml-0.5">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-[10px] text-[#888] mt-1">{hint}</p> : null}
    </div>
  );
}

export default function StaffListPage() {
  const { user, isUserLoaded } = useUser();
  const [, setLocation] = useLocation();

  const isSuperAdmin = user?.userType === "슈퍼어드민";

  useEffect(() => {
    if (isUserLoaded && !isSuperAdmin) {
      setLocation("/admin/managers");
    }
  }, [isUserLoaded, isSuperAdmin, setLocation]);

  const [currentPage, setCurrentPage] = useState(1);
  const [platform, setPlatform] = useState<OpsPlatform>("ppamong");
  const itemsPerPage = useResponsivePageSize();
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, platform]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"전체" | "부서" | "직책">("전체");
  const [tempSearchQuery, setTempSearchQuery] = useState("");

  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [selectedAdminForDeactivate, setSelectedAdminForDeactivate] =
    useState<AdminUserWithoutPassword | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [formData, setFormData] = useState<StaffFormData>(emptyForm);
  const [editingAdmin, setEditingAdmin] = useState<AdminUserWithoutPassword | null>(null);
  const [originalPasswordPlain, setOriginalPasswordPlain] = useState("");

  const { toast } = useToast();

  const { data, isLoading } = useQuery<StaffListResponse>({
    queryKey: [
      "/api/admin/staff",
      { page: currentPage, limit: itemsPerPage, search: searchQuery, filterType, platform },
    ],
    queryFn: async () => {
      const response = await adminFetch(
        `/api/admin/staff?status=승인&page=${currentPage}&limit=${itemsPerPage}&search=${searchQuery}&filterType=${filterType}&platform=${platform}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch staff list");
      }
      return response.json();
    },
    enabled: isUserLoaded && isSuperAdmin,
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
      setDeactivateConfirmOpen(false);
      toast({ description: "관리자가 삭제되었습니다." });
    },
    onError: (err: unknown) => {
      setDeactivateConfirmOpen(false);
      const message = err instanceof Error ? err.message : "삭제에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<StaffFormData> }) => {
      const body: Record<string, string> = {
        name: payload.name!,
        email: payload.email!,
        phone: payload.phone!,
        department: payload.department || "",
        position: payload.position || "",
        status: payload.status!,
      };
      if (payload.password?.trim() && payload.password !== originalPasswordPlain) {
        body.password = payload.password;
      }
      return await apiRequest("PATCH", `/api/admin/staff/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
      setEditOpen(false);
      setEditingAdmin(null);
      setOriginalPasswordPlain("");
      setFormData(emptyForm);
      toast({ description: "관리자 정보가 수정되었습니다." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "수정에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    },
  });

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
      }, 500),
    [],
  );

  useEffect(() => {
    debouncedSearch(tempSearchQuery);
    return () => debouncedSearch.cancel();
  }, [tempSearchQuery, debouncedSearch]);

  if (!isUserLoaded || !isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </AdminLayout>
    );
  }

  const admins = data?.admins || [];
  const totalPages = data?.totalPages || 1;
  const counts = data?.counts ?? { ppamong: 0, badminton9: 0 };

  const handleDeactivateClick = (admin: AdminUserWithoutPassword) => {
    setSelectedAdminForDeactivate(admin);
    setDeactivateConfirmOpen(true);
  };

  const handleDeactivateConfirm = () => {
    if (selectedAdminForDeactivate) {
      deactivateMutation.mutate(selectedAdminForDeactivate.id);
    }
  };

  const openEdit = (admin: AdminUserWithoutPassword) => {
    const plain = admin.passwordPlain ?? "";
    setEditingAdmin(admin);
    setOriginalPasswordPlain(plain);
    setFormData({
      username: admin.username,
      name: admin.name,
      email: admin.email,
      password: plain,
      phone: admin.phone,
      department: admin.department || "",
      position: admin.position || "",
      status: (admin.status as "활성화" | "비활성화") || "활성화",
    });
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    updateMutation.mutate({ id: editingAdmin.id, payload: formData });
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
      <Select
        value={filterType}
        onValueChange={(value) => setFilterType(value as "전체" | "부서" | "직책")}
      >
        <SelectTrigger
          data-testid="select-filter-type"
          className="w-[120px] h-9 border-[#E9E9E9] text-sm"
        >
          <SelectValue placeholder="전체" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="전체">전체</SelectItem>
          <SelectItem value="부서">부서</SelectItem>
          <SelectItem value="직책">직책</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={tempSearchQuery}
        onChange={(e) => setTempSearchQuery(e.target.value)}
        placeholder="이름·이메일·부서 검색"
        className="h-9 w-full sm:w-[220px] border-[#E9E9E9] text-sm"
        data-testid="input-search"
      />
    </div>
  );

  return (
    <AdminLayout>
      <AdminCompactListPage
        title="관리자 리스트"
        platformTabs={{
          platform,
          counts,
          onChange: setPlatform,
          ppamongSublabel: "ppamong.XX 등록 staff",
          badminton9Sublabel: "PG 레거시 일반어드민",
          countLabel: "명",
        }}
        actions={
          <>
            {toolbar}
            {platform === "ppamong" ? (
              <Button
                type="button"
                className="h-8 text-xs bg-[#E11936] hover:bg-[#B71C1C] text-white gap-1.5"
                onClick={() => setLocation("/admin/staff/register")}
              >
                <Plus className="h-4 w-4" />
                관리자 등록
              </Button>
            ) : null}
          </>
        }
        footer={
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        }
      >
        <AdminCompactTableShell
          minWidth={680}
          isLoading={isLoading}
          loadingCols={6}
          emptyMessage={
            admins.length === 0
              ? platform === "ppamong"
                ? "등록된 빠몽 관리자가 없습니다."
                : "빠던9 레거시 관리자가 없습니다."
              : undefined
          }
        >
          {admins.length > 0 ? (
            <AdminCompactTable minWidth={680}>
              <thead>
                <tr className={adminCompactTheadRowClass}>
                  <th className={adminCompactThClass}>이름</th>
                  <th className={adminCompactThClass}>아이디</th>
                  <th className={adminCompactThClass}>연락처</th>
                  <th className={adminCompactThClass}>부서 / 직책</th>
                  <th className={`${adminCompactThClass} text-center`}>상태</th>
                  <th className={`${adminCompactThClass} text-center w-28`}>관리</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin, index) => (
                  <tr key={admin.id} className={adminCompactTrClass} data-testid={`admin-row-${index}`}>
                    <td className={adminCompactTdClass}>
                      <p className="font-semibold">{admin.name}</p>
                      <p className="text-[10px] text-[#888] truncate max-w-[140px]" title={admin.email}>
                        {admin.email}
                      </p>
                    </td>
                    <td className={`${adminCompactTdClass} font-mono text-[#444] whitespace-nowrap`}>
                      {admin.username}
                    </td>
                    <td className={`${adminCompactTdClass} tabular-nums whitespace-nowrap`}>
                      {admin.phone}
                    </td>
                    <td className={`${adminCompactTdClass} whitespace-nowrap`}>
                      {[admin.department, admin.position].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className={`${adminCompactTdClass} text-center`}>
                      <StaffStatusBadge status={admin.status} />
                    </td>
                    <td className={adminCompactTdClass}>
                      <div className="flex items-center justify-center gap-1">
                        {platform === "ppamong" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(admin)}
                              className="px-2 py-0.5 text-[10px] font-medium text-[#4285F4] border border-[#4285F4]/30 rounded hover:bg-[#EEF4FF]"
                              data-testid={`button-edit-${index}`}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeactivateClick(admin)}
                              className="px-2 py-0.5 text-[10px] font-medium text-[#E11936] border border-[#E11936]/30 rounded hover:bg-[#FFF5F6]"
                              data-testid={`button-deactivate-${index}`}
                            >
                              삭제
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-[#AAA]">조회 전용</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminCompactTable>
          ) : null}
        </AdminCompactTableShell>
      </AdminCompactListPage>

      {deactivateConfirmOpen && selectedAdminForDeactivate && (
        <SimpleConfirmPopup
          message={`${selectedAdminForDeactivate.name} 관리자를 삭제하시겠습니까?`}
          leftButtonText="취소"
          rightButtonText="삭제"
          onLeftClick={() => setDeactivateConfirmOpen(false)}
          onRightClick={handleDeactivateConfirm}
        />
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#F0F0F0]">
            <DialogTitle className="text-lg">관리자 수정</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit}>
            <div className="px-6 py-4 border-b border-[#F0F0F0] bg-[#FAFAFA] flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF5F6] text-[#E11936]">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#201E22] truncate">{formData.name || "—"}</p>
                <p className="text-xs text-[#888] mt-0.5">
                  <span className="font-mono">{formData.username}</span>
                  {formData.department || formData.position ? (
                    <span className="text-[#AAA]">
                      {" "}
                      · {[formData.department, formData.position].filter(Boolean).join(" / ")}
                    </span>
                  ) : null}
                </p>
              </div>
              <StaffStatusBadge status={formData.status} />
            </div>

            <div className="px-6 py-5 space-y-5">
              <section>
                <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wide mb-3">
                  기본 정보
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  <FormField label="이름" required>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="h-9"
                      required
                    />
                  </FormField>
                  <FormField label="전화번호" required>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="h-9"
                      required
                    />
                  </FormField>
                  <FormField label="이메일" required className="sm:col-span-2">
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="h-9"
                      required
                    />
                  </FormField>
                  <FormField label="부서">
                    <Input
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="h-9"
                    />
                  </FormField>
                  <FormField label="직책">
                    <Input
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="h-9"
                    />
                  </FormField>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wide mb-3">
                  계정
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  <FormField label="아이디">
                    <Input value={formData.username} readOnly className="h-9 bg-[#FAFAFA] font-mono text-sm" />
                  </FormField>
                  <FormField label="상태">
                    <Select
                      value={formData.status}
                      onValueChange={(v) =>
                        setFormData({ ...formData, status: v as "활성화" | "비활성화" })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="활성화">활성화</SelectItem>
                        <SelectItem value="비활성화">비활성화</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField
                    label="비밀번호"
                    hint="슈퍼바이저 확인용 · 변경 후 저장 시 갱신"
                    className="sm:col-span-2"
                  >
                    <Input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      minLength={6}
                      className="h-9 font-mono tracking-wide"
                      autoComplete="off"
                      data-testid="input-staff-password"
                    />
                  </FormField>
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#F0F0F0] bg-[#FAFAFA]">
              <Button type="button" variant="outline" className="h-9" onClick={() => setEditOpen(false)}>
                취소
              </Button>
              <Button
                type="submit"
                className="h-9 bg-[#E11936] hover:bg-[#B71C1C]"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
