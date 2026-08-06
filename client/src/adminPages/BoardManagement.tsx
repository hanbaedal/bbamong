import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/adminQueryClient";
import AdminLayout from "./adminLayout";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminPagination from "./components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";
import type { OpsPlatform } from "./ops/opsLoginStatusUi";
import {
  AdminCompactListPage,
  AdminCompactTable,
  AdminCompactTableShell,
  adminCompactTdClass,
  adminCompactThClass,
  adminCompactTheadRowClass,
  adminCompactTrClass,
} from "./components/adminCompactListUi";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AdminPost {
  id: number;
  title: string;
  content: string;
  authorName: string;
  viewCount: number;
  createdAt: string;
  dataSource?: string;
}

interface AdminPostListResponse {
  posts: AdminPost[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  platform: OpsPlatform;
  counts: { ppamong: number; badminton9: number };
}

type SidePanelMode = "add" | "edit" | "detail" | null;

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${d} ${h}:${min}`;
}

export default function BoardManagementPage() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<OpsPlatform>("ppamong");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const itemsPerPage = useResponsivePageSize();
  const [selectedPost, setSelectedPost] = useState<AdminPost | null>(null);
  const [sidePanelMode, setSidePanelMode] = useState<SidePanelMode>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const canEdit = platform === "ppamong";

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, platform, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listQueryKey = `/api/admin/posts?platform=${platform}&page=${currentPage}&limit=${itemsPerPage}&search=${searchQuery}`;

  const { data, isLoading } = useQuery<AdminPostListResponse>({
    queryKey: [listQueryKey],
    placeholderData: (previousData) => previousData,
  });

  const posts = data?.posts ?? [];
  const totalPages = data?.totalPages ?? 1;
  const counts = data?.counts ?? { ppamong: 0, badminton9: 0 };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/posts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/posts/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleteTargetId(null);
      handleCloseSidePanel();
      toast({ description: "게시물이 삭제되었습니다." });
    },
    onError: () => {
      toast({ variant: "destructive", description: "삭제에 실패했습니다." });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { title: formTitle.trim(), content: formContent.trim() };
      if (sidePanelMode === "add") {
        return apiRequest("POST", "/api/admin/posts", payload);
      }
      if (sidePanelMode === "edit" && selectedPost) {
        return apiRequest("PATCH", `/api/admin/posts/${selectedPost.id}`, payload);
      }
      throw new Error("invalid mode");
    },
    onSuccess: () => {
      invalidate();
      handleCloseSidePanel();
      toast({ description: sidePanelMode === "add" ? "게시글이 등록되었습니다." : "게시글이 수정되었습니다." });
    },
    onError: () => {
      toast({ variant: "destructive", description: "저장에 실패했습니다." });
    },
  });

  const handleOpenAdd = () => {
    setSelectedPost(null);
    setFormTitle("");
    setFormContent("");
    setSidePanelMode("add");
  };

  const handleOpenEdit = (post: AdminPost) => {
    setSelectedPost(post);
    setFormTitle(post.title);
    setFormContent(post.content);
    setSidePanelMode("edit");
  };

  const handleOpenDetail = (post: AdminPost) => {
    setSelectedPost(post);
    setSidePanelMode("detail");
  };

  const handleCloseSidePanel = () => {
    setSidePanelMode(null);
    setSelectedPost(null);
    setFormTitle("");
    setFormContent("");
  };

  return (
    <AdminLayout>
      <AdminCompactListPage
        title="게시판 관리"
        platformTabs={{
          platform,
          counts,
          onChange: setPlatform,
          ppamongSublabel: "빠몽 앱 게시글",
          badminton9Sublabel: "PG 레거시 (읽기 전용)",
          countLabel: "건",
        }}
        actions={
          <div className="flex items-center gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="제목 검색"
              className="h-8 w-[160px] text-xs border-[#E9E9E9]"
              data-testid="input-board-search"
            />
            {canEdit ? (
              <Button
                size="sm"
                className="h-8 text-xs bg-[#E57373] hover:bg-[#EF5350]"
                onClick={handleOpenAdd}
                data-testid="button-add-post"
              >
                + 게시글 추가
              </Button>
            ) : null}
          </div>
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
          minWidth={640}
          isLoading={isLoading}
          loadingCols={5}
          emptyMessage={
            posts.length === 0
              ? platform === "ppamong"
                ? "빠몽 게시글이 없습니다."
                : "빠던9 레거시 게시글이 없습니다."
              : undefined
          }
        >
          {posts.length > 0 ? (
            <AdminCompactTable minWidth={640}>
              <thead>
                <tr className={adminCompactTheadRowClass}>
                  <th className={adminCompactThClass}>No</th>
                  <th className={adminCompactThClass}>등록일</th>
                  <th className={`${adminCompactThClass} min-w-[160px]`}>제목</th>
                  <th className={`${adminCompactThClass} text-center`}>조회</th>
                  <th className={`${adminCompactThClass} w-28`}>관리</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post, index) => (
                  <tr key={post.id} className={adminCompactTrClass} data-testid={`post-row-${index}`}>
                    <td className={`${adminCompactTdClass} text-[#888] tabular-nums`}>#{post.id}</td>
                    <td className={`${adminCompactTdClass} tabular-nums whitespace-nowrap text-[#666]`}>
                      {formatDate(post.createdAt)}
                    </td>
                    <td
                      className={`${adminCompactTdClass} max-w-[200px] truncate cursor-pointer`}
                      title={post.title}
                      onClick={() => handleOpenDetail(post)}
                    >
                      {post.title}
                    </td>
                    <td className={`${adminCompactTdClass} text-center tabular-nums`}>
                      {post.viewCount}
                    </td>
                    <td className={adminCompactTdClass}>
                      <div className="flex gap-1">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(post)}
                            className="px-2 py-0.5 text-[10px] font-medium text-white bg-[#4285F4] rounded hover:bg-[#3367D6]"
                            data-testid={`button-edit-${index}`}
                          >
                            수정
                          </button>
                        ) : null}
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(post.id)}
                            className="px-2 py-0.5 text-[10px] font-medium text-white bg-[#E57373] rounded hover:bg-[#EF5350]"
                            data-testid={`button-delete-${index}`}
                          >
                            삭제
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(post)}
                            className="px-2 py-0.5 text-[10px] font-medium text-white bg-[#4285F4] rounded hover:bg-[#3367D6]"
                          >
                            보기
                          </button>
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

      {deleteTargetId !== null && (
        <SimpleConfirmPopup
          message="해당 게시물을 삭제하시겠어요?"
          leftButtonText="취소"
          rightButtonText="삭제"
          onLeftClick={() => setDeleteTargetId(null)}
          onRightClick={() => deleteMutation.mutate(deleteTargetId)}
        />
      )}

      {sidePanelMode && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={handleCloseSidePanel} />
          <div className="fixed right-0 top-0 h-full w-full max-w-[720px] bg-white z-[70] shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[#E9E9E9]">
              <h2 className="text-lg font-bold text-[#201E22]">
                {sidePanelMode === "add"
                  ? "게시글 추가"
                  : sidePanelMode === "edit"
                    ? "게시글 수정"
                    : "게시글 상세"}
              </h2>
              <button type="button" onClick={handleCloseSidePanel} className="text-[#BFBFBF] hover:text-[#201E22]">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              {sidePanelMode === "detail" && selectedPost ? (
                <>
                  <div>
                    <p className="text-xs text-[#888] mb-1">제목</p>
                    <p className="font-semibold text-[#201E22]">{selectedPost.title}</p>
                  </div>
                  <div className="text-xs text-[#666]">등록일 {formatDate(selectedPost.createdAt)}</div>
                  <div className="border-t border-[#E9E9E9] pt-3 whitespace-pre-wrap leading-relaxed">
                    {selectedPost.content}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-[#888] mb-1 block">제목</label>
                    <Input
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="text-sm"
                      data-testid="input-post-title"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#888] mb-1 block">내용</label>
                    <Textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      className="min-h-[200px] text-sm"
                      data-testid="textarea-post-content"
                    />
                  </div>
                  <Button
                    className="w-full bg-[#201E22] hover:bg-[#3A3A3A]"
                    disabled={saveMutation.isPending || !formTitle.trim() || !formContent.trim()}
                    onClick={() => saveMutation.mutate()}
                    data-testid="button-save-post"
                  >
                    {saveMutation.isPending ? "저장 중..." : "저장하기"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
