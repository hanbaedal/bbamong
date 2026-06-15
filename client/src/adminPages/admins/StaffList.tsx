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
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useUser } from "@/contexts/UserContext";
import AdminPagination from "../components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";

type AdminUserWithoutPassword = Omit<AdminUser, "password">;

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
  const itemsPerPage = useResponsivePageSize();
  useEffect(() => { setCurrentPage(1); }, [itemsPerPage]);
  const { assets } = useAdminAssets();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"전체" | "부서" | "직책">(
    "전체",
  );
  const [tempSearchQuery, setTempSearchQuery] = useState("");

  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [selectedAdminForDeactivate, setSelectedAdminForDeactivate] =
    useState<AdminUserWithoutPassword | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [formData, setFormData] = useState<StaffFormData>(emptyForm);
  const [editingAdmin, setEditingAdmin] = useState<AdminUserWithoutPassword | null>(null);

  const { toast } = useToast();

  const { data, isLoading } = useQuery<StaffListResponse>({
    queryKey: [
      "/api/admin/staff",
      { page: currentPage, limit: itemsPerPage, search: searchQuery, filterType },
    ],
    queryFn: async () => {
      const response = await adminFetch(
        `/api/admin/staff?status=승인&page=${currentPage}&limit=${itemsPerPage}&search=${searchQuery}&filterType=${filterType}`
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
      return await apiRequest(
        "DELETE",
        `/api/admin/users/${id}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/staff"],
      });
      setDeactivateConfirmOpen(false);
      toast({ description: "관리자가 삭제되었습니다." });
    },
    onError: (err: any) => {
      setDeactivateConfirmOpen(false);
      toast({ variant: "destructive", description: err?.message || "삭제에 실패했습니다." });
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
      if (payload.password?.trim()) {
        body.password = payload.password;
      }
      return await apiRequest("PATCH", `/api/admin/staff/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
      setEditOpen(false);
      setEditingAdmin(null);
      setFormData(emptyForm);
      toast({ description: "관리자 정보가 수정되었습니다." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", description: err?.message || "수정에 실패했습니다." });
    },
  });

  // 디바운스 함수 생성 (500ms)
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
      }, 500),
    [],
  );

  // tempSearchQuery가 변경될 때마다 디바운스 실행
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
  const approvedCount = data?.approvedCount || 0;

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
    setEditingAdmin(admin);
    setFormData({
      username: admin.username,
      name: admin.name,
      email: admin.email,
      password: "",
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

  function StaffFormFields() {
    return (
      <div className="grid gap-4 py-2">
        <div className="space-y-2">
          <Label>이름</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>이메일</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>비밀번호 (변경 시만 입력)</Label>
          <Input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            minLength={6}
          />
        </div>
        <div className="space-y-2">
          <Label>전화번호</Label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>부서</Label>
          <Input
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>직책</Label>
          <Input
            value={formData.position}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>상태</Label>
          <Select
            value={formData.status}
            onValueChange={(v) => setFormData({ ...formData, status: v as "활성화" | "비활성화" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="활성화">활성화</SelectItem>
              <SelectItem value="비활성화">비활성화</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  function SkeletonRow() {
    return (
      <div className="grid grid-cols-[16%_10%_16%_14%_14%_14%_16%] px-2 md:px-4 py-2 md:py-5 bg-white border-b border-[#E9E9E9] items-center h-16">
        <div className="h-3.5 bg-[#E9E9E9] rounded w-16 animate-pulse" />
        <div className="h-3.5 bg-[#E9E9E9] rounded w-12 animate-pulse" />
        <div className="h-3.5 bg-[#E9E9E9] rounded w-32 animate-pulse" />
        <div className="h-3.5 bg-[#E9E9E9] rounded w-16 animate-pulse" />
        <div className="h-3.5 bg-[#E9E9E9] rounded w-12 animate-pulse" />
        <div className="h-3.5 bg-[#E9E9E9] rounded w-24 animate-pulse" />
        <div className="h-6 bg-[#E9E9E9] rounded w-16 animate-pulse" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 mb-3 md:mb-4 lg:mb-6 shrink-0" data-testid="breadcrumb">
          <span className="text-xs md:text-sm text-[#BFBFBF]">관리자 관리</span>
          <span className="text-xs md:text-sm text-[#BFBFBF]">&gt;</span>
          <span className="text-xs md:text-sm text-[#201E22]">관리자 리스트</span>
        </div>

        <div className="mb-3 md:mb-4 lg:mb-6 shrink-0">
          <h1
            className="text-lg md:text-xl lg:text-2xl font-semibold text-[#201E22] flex items-center gap-2"
            data-testid="text-page-title"
          >
            <img src={assets.adListIcon} className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" alt="icon" /> 관리자 리스트
          </h1>
          <p className="text-sm text-[#666] mt-1">
            슈퍼바이저가 등록한 관리자 목록 · 수정·삭제 (총 {approvedCount}명)
          </p>
        </div>

        <div className="flex justify-end border-b border-[#E9E9E9] mb-3 md:mb-4 lg:mb-6 shrink-0 pb-3">
          <div className="flex gap-3 items-center w-full sm:w-auto">
            <Select
              value={filterType}
              onValueChange={(value) =>
                setFilterType(value as "전체" | "부서" | "직책")
              }
            >
              <SelectTrigger
                data-testid="select-filter-type"
                className="w-[150px] px-4 py-2 border border-[#E9E9E9] rounded text-sm text-[#201E22] bg-white focus:outline-none focus:border-[#E11936]"
              >
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체">전체</SelectItem>
                <SelectItem value="부서">부서</SelectItem>
                <SelectItem value="직책">직책</SelectItem>
              </SelectContent>
            </Select>

            <input
              type="text"
              value={tempSearchQuery}
              onChange={(e) => setTempSearchQuery(e.target.value)}
              placeholder="검색어를 입력하세요"
              className="flex-1 px-4 py-2 border border-[#E9E9E9] rounded text-sm text-[#201E22] placeholder-[#BFBFBF] focus:outline-none focus:border-[#E11936]"
              data-testid="input-search"
            />
          </div>
        </div>

        <div className="overflow-x-auto shrink-0">
        <div className="grid grid-cols-[14%_9%_15%_11%_11%_12%_28%] min-w-[720px] px-2 md:px-4 py-2 md:py-3 bg-[#F9F9F9] text-xs md:text-sm font-medium text-[#4D4B4E]">
          <div>아이디</div>
          <div>이름</div>
          <div>이메일</div>
          <div>부서</div>
          <div>직책</div>
          <div>전화번호</div>
          <div>관리</div>
        </div>
        </div>

        {/* 테이블 바디 - 내부 스크롤 */}
        <div className="flex-1 overflow-auto min-h-0">
          <div className="overflow-x-auto min-w-0">
          {isLoading ? (
            <div className="space-y-0">
              {Array.from({ length: itemsPerPage }).map((_, index) => (
                <SkeletonRow key={index} />
              ))}
            </div>
          ) : admins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 md:py-24 lg:py-32">
              <p className="text-sm md:text-base text-[#BFBFBF]">
                등록된 관리자가 없습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {admins.map((admin, index) => (
                <div
                  key={admin.id}
                  className="grid grid-cols-[14%_9%_15%_11%_11%_12%_28%] min-w-[720px] px-2 md:px-4 py-2 md:py-5 bg-white border-b border-[#E9E9E9] text-xs md:text-sm text-[#201E22] items-center min-h-16"
                  data-testid={`admin-row-${index}`}
                >
                  <div className="truncate" title={admin.id}>
                    {admin.username && admin.username.length > 16
                      ? `${admin.username.substring(0, 16)}...`
                      : admin.username}
                  </div>
                  <div className="truncate" title={admin.name}>
                    {admin.name}
                  </div>
                  <div className="truncate" title={admin.email}>
                    {admin.email}
                  </div>
                  <div className="truncate" title={admin.department ?? undefined}>
                    {admin.department}
                  </div>
                  <div className="truncate" title={admin.position ?? undefined}>
                    {admin.position}
                  </div>
                  <div className="truncate" title={admin.phone}>
                    {admin.phone}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => openEdit(admin)}
                      className="px-2 py-1 text-[10px] md:text-xs font-medium text-white bg-[#4285F4] rounded hover:bg-[#357AE8]"
                      data-testid={`button-edit-${index}`}
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDeactivateClick(admin)}
                      className="px-2 py-1 text-[10px] md:text-xs font-medium text-white bg-[#E11936] rounded hover:bg-[#C71530]"
                      data-testid={`button-deactivate-${index}`}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        <AdminPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>관리자 수정 — {editingAdmin?.username}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <StaffFormFields />
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                취소
              </Button>
              <Button type="submit" className="bg-[#E11936] hover:bg-[#B71C1C]" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
