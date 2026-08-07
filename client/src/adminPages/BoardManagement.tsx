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

interface AdminPost {
  id: number;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  viewCount: number;
  commentCount: number;
  createdAt: string;
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

interface AdminPostDetail extends AdminPost {
  comments: Array<{
    id: number;
    content: string;
    authorName: string;
    createdAt: string;
  }>;
}

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
  const [selectedPost, setSelectedPost] = useState<AdminPostDetail | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/posts"] });
      setDeleteTargetId(null);
      if (selectedPost?.id === deleteTargetId) {
        handleCloseSidePanel();
      }
      toast({ description: "게시물이 삭제되었습니다." });
    },
    onError: () => {
      toast({ variant: "destructive", description: "삭제에 실패했습니다." });
    },
  });

  const handleOpenDetail = async (post: AdminPost) => {
    try {
      const res = await apiRequest("GET", `/api/admin/posts/${post.id}`);
      const detail = (await res.json()) as AdminPostDetail;
      setSelectedPost(detail);
      setShowSidePanel(true);
    } catch {
      toast({ variant: "destructive", description: "게시물을 불러오지 못했습니다." });
    }
  };

  const handleCloseSidePanel = () => {
    setShowSidePanel(false);
    setSelectedPost(null);
  };

  return (
    <AdminLayout>
      <AdminCompactListPage
        title="게시판 관리"
        platformTabs={{
          platform,
          counts,
          onChange: setPlatform,
          ppamongSublabel: "빠몽 앱 회원 게시글",
          badminton9Sublabel: "PG 레거시 (읽기 전용)",
          countLabel: "건",
        }}
        actions={
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="제목 검색"
            className="h-8 w-[160px] text-xs border-[#E9E9E9]"
            data-testid="input-board-search"
          />
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
          minWidth={720}
          isLoading={isLoading}
          loadingCols={7}
          emptyMessage={
            posts.length === 0
              ? platform === "ppamong"
                ? "빠몽 게시글이 없습니다."
                : "빠던9 레거시 게시글이 없습니다."
              : undefined
          }
        >
          {posts.length > 0 ? (
            <AdminCompactTable minWidth={720}>
              <thead>
                <tr className={adminCompactTheadRowClass}>
                  <th className={adminCompactThClass}>No</th>
                  <th className={adminCompactThClass}>등록일</th>
                  <th className={`${adminCompactThClass} min-w-[160px]`}>제목</th>
                  <th className={adminCompactThClass}>작성자</th>
                  <th className={`${adminCompactThClass} text-center`}>조회</th>
                  <th className={`${adminCompactThClass} text-center`}>댓글</th>
                  <th className={`${adminCompactThClass} w-24`}>관리</th>
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
                      className={`${adminCompactTdClass} max-w-[200px] truncate`}
                      title={post.title}
                    >
                      {post.title}
                    </td>
                    <td className={`${adminCompactTdClass} whitespace-nowrap`}>
                      <span className="font-medium">{post.authorName}</span>
                      <span className="block text-[10px] text-[#888]">{post.authorUsername}</span>
                    </td>
                    <td className={`${adminCompactTdClass} text-center tabular-nums`}>
                      {post.viewCount}
                    </td>
                    <td className={`${adminCompactTdClass} text-center tabular-nums`}>
                      {post.commentCount}
                    </td>
                    <td className={adminCompactTdClass}>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => void handleOpenDetail(post)}
                          className="px-2 py-0.5 text-[10px] font-medium text-white bg-[#4285F4] rounded hover:bg-[#3367D6]"
                          data-testid={`button-view-${index}`}
                        >
                          보기
                        </button>
                        {platform === "ppamong" ? (
                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(post.id)}
                            className="px-2 py-0.5 text-[10px] font-medium text-white bg-[#E57373] rounded hover:bg-[#EF5350]"
                            data-testid={`button-delete-${index}`}
                          >
                            삭제
                          </button>
                        ) : null}
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
          message="해당 게시물과 댓글을 모두 삭제하시겠어요?"
          leftButtonText="취소"
          rightButtonText="삭제"
          onLeftClick={() => setDeleteTargetId(null)}
          onRightClick={() => deleteMutation.mutate(deleteTargetId)}
        />
      )}

      {showSidePanel && selectedPost && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={handleCloseSidePanel}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-[720px] bg-white z-[70] shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[#E9E9E9]">
              <h2 className="text-lg font-bold text-[#201E22]">게시글 상세</h2>
              <button type="button" onClick={handleCloseSidePanel} className="text-[#BFBFBF] hover:text-[#201E22]">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div>
                <p className="text-xs text-[#888] mb-1">제목</p>
                <p className="font-semibold text-[#201E22]">{selectedPost.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#888]">작성자 </span>
                  <span>{selectedPost.authorName} ({selectedPost.authorUsername})</span>
                </div>
                <div>
                  <span className="text-[#888]">등록일 </span>
                  <span>{formatDate(selectedPost.createdAt)}</span>
                </div>
                <div>
                  <span className="text-[#888]">조회 </span>
                  <span>{selectedPost.viewCount}</span>
                </div>
                <div>
                  <span className="text-[#888]">댓글 </span>
                  <span>{selectedPost.comments.length}</span>
                </div>
              </div>
              <div className="border-t border-[#E9E9E9] pt-3">
                <p className="text-xs text-[#888] mb-2">내용</p>
                <p className="whitespace-pre-wrap leading-relaxed text-[#201E22]">{selectedPost.content}</p>
              </div>
              {selectedPost.comments.length > 0 && (
                <div className="border-t border-[#E9E9E9] pt-3">
                  <p className="text-xs font-semibold text-[#201E22] mb-2">댓글</p>
                  <ul className="space-y-2">
                    {selectedPost.comments.map((comment) => (
                      <li key={comment.id} className="rounded bg-[#FAFAFA] px-3 py-2 text-xs">
                        <p className="font-medium text-[#201E22]">{comment.authorName}</p>
                        <p className="text-[#666] mt-1 whitespace-pre-wrap">{comment.content}</p>
                        <p className="text-[10px] text-[#AAA] mt-1">{formatDate(comment.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                type="button"
                onClick={() => setDeleteTargetId(selectedPost.id)}
                className="w-full h-10 bg-[#E57373] text-white font-semibold rounded hover:bg-[#EF5350] text-sm"
              >
                게시물 삭제
              </button>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
