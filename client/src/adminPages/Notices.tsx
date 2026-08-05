import { useState, useEffect, useMemo } from "react";
import AdminLayout from "./adminLayout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/adminQueryClient";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";
import { X, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminPagination from "./components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";
import { OpsPlatformTabs, type OpsPlatform } from "./ops/opsLoginStatusUi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Notice {
  id: number;
  tag: string;
  title: string;
  content: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  dataSource?: string;
}

interface NoticeListResponse {
  notices: Notice[];
  platform: OpsPlatform;
  counts: { ppamong: number; badminton9: number };
}

type SidePanelMode = "add" | "detail" | null;

function getTagColor(tag: string): string {
  switch (tag) {
    case "긴급":
      return "bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]";
    case "중요":
      return "bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]";
    case "보통":
      return "bg-[#E3F2FD] text-[#1565C0] border border-[#BBDEFB]";
    default:
      return "bg-[#F5F5F5] text-[#666] border border-[#EEEEEE]";
  }
}

function SortableNoticeRow({
  notice,
  index,
  formatDate,
  handleDeleteClick,
  handleRowClick,
}: {
  notice: Notice;
  index: number;
  formatDate: (date: string) => string;
  handleDeleteClick: (id: number, e: React.MouseEvent) => void;
  handleRowClick: (notice: Notice) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: notice.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      onClick={() => handleRowClick(notice)}
      className="border-b border-[#EDE9F6]/80 cursor-pointer hover:bg-[#FAFAFA] transition-colors"
      data-testid={`notice-row-${index}`}
    >
      <td className="px-2 py-1.5 w-8">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-[#BFBFBF] touch-none"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </button>
      </td>
      <td className="px-2 py-1.5 text-[#888] tabular-nums whitespace-nowrap">#{notice.id}</td>
      <td className="px-2 py-1.5 text-[#666] tabular-nums whitespace-nowrap">
        {formatDate(notice.createdAt)}
      </td>
      <td className="px-2 py-1.5 text-[#201E22] max-w-[280px] truncate" title={notice.title}>
        {notice.title}
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium", getTagColor(notice.tag))}>
          {notice.tag}
        </span>
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <button
          type="button"
          onClick={(e) => handleDeleteClick(notice.id, e)}
          className="px-2 py-0.5 text-[10px] font-medium text-white bg-[#E57373] rounded hover:bg-[#EF5350]"
          data-testid={`button-delete-${index}`}
        >
          삭제
        </button>
      </td>
    </tr>
  );
}

export default function NoticesPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [platform, setPlatform] = useState<OpsPlatform>("ppamong");
  const itemsPerPage = useResponsivePageSize();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedNoticeId, setSelectedNoticeId] = useState<number | null>(null);
  const { toast } = useToast();

  const [sidePanelMode, setSidePanelMode] = useState<SidePanelMode>(null);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formTag, setFormTag] = useState("노출");
  const [formContent, setFormContent] = useState("");

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, platform]);

  const { data, isLoading } = useQuery<NoticeListResponse>({
    queryKey: ["/api/notices", platform],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/notices?platform=${platform}`);
      return res.json();
    },
  });

  const allNotices = data?.notices ?? [];
  const counts = data?.counts ?? { ppamong: 0, badminton9: 0 };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const invalidateNotices = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/notices"] });
  };

  const createMutation = useMutation({
    mutationFn: async (payload: { tag: string; title: string; content: string }) => {
      return await apiRequest("POST", "/api/notices", payload);
    },
    onSuccess: () => {
      invalidateNotices();
      handleCloseSidePanel();
      toast({ description: "공지사항이 등록되었습니다." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: payload }: { id: number; data: { tag: string; title: string; content: string } }) => {
      return await apiRequest("PATCH", `/api/notices/${id}`, payload);
    },
    onSuccess: () => {
      handleCloseSidePanel();
      toast({ description: "공지사항이 수정되었습니다." });
      invalidateNotices();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/notices/${id}`);
    },
    onSuccess: () => {
      invalidateNotices();
      toast({ description: "공지사항이 삭제되었습니다." });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: number; displayOrder: number }[]) => {
      return await apiRequest("PUT", "/api/notices/reorder", { updates });
    },
    onSuccess: () => {
      invalidateNotices();
      toast({ description: "순서가 변경되었습니다." });
    },
  });

  const handleOpenAddPanel = () => {
    if (platform !== "ppamong") {
      toast({
        variant: "destructive",
        description: "새 공지는 빠몽 탭에서 등록합니다. (빠던9는 PG 레거시 조회 전용)",
      });
      return;
    }
    setSidePanelMode("add");
    setFormTitle("");
    setFormTag("노출");
    setFormContent("");
    setIsEditMode(false);
  };

  const handleRowClick = (notice: Notice) => {
    setSelectedNotice(notice);
    setSidePanelMode("detail");
    setFormTitle(notice.title);
    setFormTag(notice.tag);
    setFormContent(notice.content);
    setIsEditMode(false);
  };

  const handleCloseSidePanel = () => {
    setSidePanelMode(null);
    setSelectedNotice(null);
    setFormTitle("");
    setFormTag("노출");
    setFormContent("");
    setIsEditMode(false);
  };

  const handleSubmit = () => {
    if (!formTitle.trim()) {
      toast({ variant: "destructive", description: "제목을 입력해주세요." });
      return;
    }
    if (!formContent.trim()) {
      toast({ variant: "destructive", description: "내용을 입력해주세요." });
      return;
    }

    const payload = {
      tag: formTag,
      title: formTitle,
      content: formContent,
    };

    if (sidePanelMode === "add") {
      createMutation.mutate(payload);
    } else if (sidePanelMode === "detail" && selectedNotice) {
      updateMutation.mutate({ id: selectedNotice.id, data: payload });
    }
  };

  const handleDeleteClick = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNoticeId(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (selectedNoticeId) {
      deleteMutation.mutate(selectedNoticeId);
    }
    setShowDeleteConfirm(false);
    setSelectedNoticeId(null);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setSelectedNoticeId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageNotices = allNotices.slice(startIndex, endIndex);

    const oldIndex = pageNotices.findIndex((item) => item.id === active.id);
    const newIndex = pageNotices.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(pageNotices, oldIndex, newIndex);
    const updates = reordered.map((notice, index) => ({
      id: notice.id,
      displayOrder: startIndex + index,
    }));

    reorderMutation.mutate(updates);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  const totalPages = Math.max(1, Math.ceil(allNotices.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentNotices = useMemo(
    () => allNotices.slice(startIndex, startIndex + itemsPerPage),
    [allNotices, startIndex, itemsPerPage],
  );

  const canEditSelected =
    platform === "ppamong" &&
    (sidePanelMode === "add" || selectedNotice?.dataSource !== "badminton9");

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0 -mx-3 sm:-mx-4 md:-mx-5 lg:-mx-6 xl:-mx-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8">
          <p className="text-sm font-semibold text-[#201E22]" data-testid="text-page-title">
            공지 사항
            {reorderMutation.isPending && (
              <span className="ml-2 text-xs font-normal text-[#E11936]">순서 저장 중…</span>
            )}
          </p>
          <Button
            size="sm"
            className="h-8 text-xs bg-[#E57373] hover:bg-[#EF5350]"
            onClick={handleOpenAddPanel}
            data-testid="button-add-notice"
          >
            + 공지 추가
          </Button>
        </div>

        <div className="px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8 mb-3">
          <OpsPlatformTabs
            platform={platform}
            counts={counts}
            onChange={setPlatform}
            ppamongSublabel="빠몽 앱 공지"
            badminton9Sublabel="PG 레거시 공지"
          />
        </div>

        <div className="flex-1 overflow-auto min-h-0 mx-3 sm:mx-4 md:mx-5 lg:mx-6 xl:mx-8 border border-[#E8E4F3] rounded-lg overflow-x-auto">
          {isLoading ? (
            <table className="w-full text-xs min-w-[640px] border-collapse">
              <thead>
                <tr className="bg-[#F3F0FF] border-b border-[#E8E4F3] text-left text-[11px] text-[#6B5B95]">
                  <th className="px-2 py-2 w-8" aria-label="순서" />
                  <th className="px-2 py-2 font-semibold">No</th>
                  <th className="px-2 py-2 font-semibold">등록일</th>
                  <th className="px-2 py-2 font-semibold">제목</th>
                  <th className="px-2 py-2 font-semibold">상태</th>
                  <th className="px-2 py-2 font-semibold w-16">관리</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: itemsPerPage }).map((_, index) => (
                  <tr key={index} className="border-b border-[#F0F0F0] animate-pulse">
                    {Array.from({ length: 6 }).map((__, col) => (
                      <td key={col} className="px-2 py-2">
                        <div className="h-3 bg-[#E9E9E9] rounded" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : currentNotices.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#BFBFBF]">
              {platform === "ppamong" ? "빠몽 공지가 없습니다." : "빠던9 레거시 공지가 없습니다."}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="w-full text-xs min-w-[640px] border-collapse">
                <thead>
                  <tr className="bg-[#F3F0FF] border-b border-[#E8E4F3] text-left text-[11px] text-[#6B5B95]">
                    <th className="px-2 py-2 w-8" aria-label="순서" />
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">No</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">등록일</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap min-w-[200px]">제목</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">상태</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap w-16">관리</th>
                  </tr>
                </thead>
                <SortableContext items={currentNotices.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {currentNotices.map((notice, index) => (
                      <SortableNoticeRow
                        key={notice.id}
                        notice={notice}
                        index={index}
                        formatDate={formatDate}
                        handleDeleteClick={handleDeleteClick}
                        handleRowClick={handleRowClick}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
          )}
        </div>

        <div className="px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8 mt-3">
          <AdminPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </div>

      {showDeleteConfirm && (
        <SimpleConfirmPopup
          message="해당 공지사항을 삭제하시겠어요?"
          leftButtonText="취소"
          rightButtonText="확인"
          onLeftClick={handleCancelDelete}
          onRightClick={handleConfirmDelete}
        />
      )}

      {sidePanelMode && (
        <div className="fixed inset-0 bg-black/50 z-[60]" onClick={handleCloseSidePanel} />
      )}

      {sidePanelMode && (
        <div
          className="fixed right-0 top-0 h-full w-full max-w-[min(800px,100vw)] bg-white shadow-lg z-[70] flex flex-col"
          style={{ animation: "slideInRight 0.3s ease-out" }}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#E9E9E9]">
            <h2 className="text-base font-semibold text-[#201E22]">공지사항 상세</h2>
            <button
              type="button"
              onClick={handleCloseSidePanel}
              className="text-[#BFBFBF] hover:text-[#201E22]"
              data-testid="button-close-panel"
            >
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="mb-5">
              <label className="block text-xs font-medium text-[#888] mb-1.5">공지사항 제목</label>
              {sidePanelMode === "add" || isEditMode ? (
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="제목을 입력해 주세요."
                  className="w-full px-3 py-2 border border-[#E9E9E9] rounded-lg text-sm focus:outline-none focus:border-[#E11936]"
                  data-testid="input-title"
                />
              ) : (
                <div className="text-sm text-[#201E22] font-medium">{selectedNotice?.title}</div>
              )}
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-[#888] mb-1.5">부문 선택</label>
              {sidePanelMode === "add" || isEditMode ? (
                <div className="flex flex-wrap gap-1.5">
                  {["노출", "보통", "중요", "긴급"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setFormTag(tag)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                        formTag === tag
                          ? "bg-[#E57373] text-white"
                          : "bg-[#F5F5F5] text-[#666] hover:bg-[#E9E9E9]",
                      )}
                      data-testid={`button-tag-${tag}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : (
                <span className={cn("inline-flex px-2 py-0.5 rounded text-xs font-medium", getTagColor(selectedNotice?.tag ?? ""))}>
                  {selectedNotice?.tag}
                </span>
              )}
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-[#888] mb-1.5">공지사항 내용</label>
              {sidePanelMode === "add" || isEditMode ? (
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="내용을 입력해 주세요."
                  rows={12}
                  className="w-full px-3 py-2 border border-[#E9E9E9] rounded-lg text-sm focus:outline-none focus:border-[#E11936] resize-none"
                  data-testid="textarea-content"
                />
              ) : (
                <div className="text-sm text-[#201E22] whitespace-pre-wrap leading-relaxed">
                  {selectedNotice?.content}
                </div>
              )}
            </div>
          </div>

          <div className="px-5 py-3 border-t border-[#E9E9E9]">
            {sidePanelMode === "add" ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="w-full h-10 bg-[#201E22] text-white rounded-lg text-sm font-medium hover:bg-[#2A2A2A] disabled:opacity-50"
                data-testid="button-submit"
              >
                {createMutation.isPending ? "등록 중..." : "등록하기"}
              </button>
            ) : isEditMode ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={updateMutation.isPending || !canEditSelected}
                className="w-full h-10 bg-[#201E22] text-white rounded-lg text-sm font-medium hover:bg-[#2A2A2A] disabled:opacity-50"
                data-testid="button-update"
              >
                {updateMutation.isPending ? "저장 중..." : "저장하기"}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!canEditSelected) {
                      toast({
                        variant: "destructive",
                        description: "빠던9 레거시 공지는 조회만 가능합니다.",
                      });
                      return;
                    }
                    setIsEditMode(true);
                  }}
                  className="flex-1 h-10 bg-[#F5F5F5] text-[#201E22] rounded-lg text-sm font-medium hover:bg-[#E9E9E9]"
                  data-testid="button-edit"
                >
                  수정하기
                </button>
                <button
                  type="button"
                  onClick={handleCloseSidePanel}
                  className="flex-1 h-10 border border-[#E9E9E9] rounded-lg text-sm font-medium"
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
