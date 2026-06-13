import { useState, useEffect } from "react";
import AdminLayout from "./adminLayout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/adminQueryClient";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";
import { X, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import AdminPagination from "./components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";
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
}

type SidePanelMode = 'add' | 'detail' | null;

// Sortable Row Component
function SortableNoticeRow({ notice, index, formatDate, getTagColor, handleDeleteClick, handleRowClick }: {
  notice: Notice;
  index: number;
  formatDate: (date: string) => string;
  getTagColor: (tag: string) => string;
  handleDeleteClick: (id: number, e: React.MouseEvent) => void;
  handleRowClick: (notice: Notice) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: notice.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => handleRowClick(notice)}
      className="relative grid grid-cols-[8%_16%_46%_14%_16%] px-2 md:px-4 h-16 bg-white border-b border-[#E9E9E9] items-center text-xs md:text-sm text-[#201E22] cursor-pointer hover:bg-[#F7F7F7]"
      data-testid={`notice-row-${index}`}
    >
      <div className="absolute left-0 px-2 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical size={20} className="text-[#BFBFBF]" />
      </div>
      <div className="text-[#414141] pl-8">#{notice.id}</div>
      <div className="text-[#414141] text-xs">
        {formatDate(notice.createdAt)}
      </div>
      <div className="truncate text-[#414141]" title={notice.title}>
        {notice.title}
      </div>
      <div>
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${getTagColor(notice.tag)}`}
        >
          {notice.tag}
        </span>
      </div>
      <div>
        <button
          onClick={(e) => handleDeleteClick(notice.id, e)}
          className="px-2 md:px-3 py-1 text-[10px] md:text-xs font-medium text-white bg-[#E11936] rounded hover:bg-[#C71530]"
          data-testid={`button-delete-${index}`}
        >
          삭제
        </button>
      </div>
    </div>
  );
}

export default function NoticesPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useResponsivePageSize();
  useEffect(() => { setCurrentPage(1); }, [itemsPerPage]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedNoticeId, setSelectedNoticeId] = useState<number | null>(null);
  const {assets} = useAdminAssets();
  const { toast } = useToast();
  
  // 사이드 패널 상태
  const [sidePanelMode, setSidePanelMode] = useState<SidePanelMode>(null);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // 폼 상태
  const [formTitle, setFormTitle] = useState("");
  const [formTag, setFormTag] = useState("노출");
  const [formContent, setFormContent] = useState("");

  const { data: allNotices, isLoading, refetch } = useQuery<Notice[]>({
    queryKey: ["/api/notices"],
    queryFn: async () => {
      const res = await apiRequest("GET", '/api/notices');
      return res.json(); // 반드시 Notice[] 반환
    },
  });

  // 드래그 앤 드롭 센서
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const createMutation = useMutation({
    mutationFn: async (data: { tag: string; title: string; content: string }) => {
      return await apiRequest("POST", "/api/notices", data);
    },
    onSuccess: () => {
      refetch();
      handleCloseSidePanel();
      toast({ description: "공지사항이 등록되었습니다." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { tag: string; title: string; content: string } }) => {
      return await apiRequest("PATCH", `/api/notices/${id}`, data);
    },
    onSuccess: () => {
      handleCloseSidePanel();
      toast({ description: "공지사항이 수정되었습니다." });
      refetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/notices/${id}`);
    },
    onSuccess: () => {
      refetch();
      toast({ description: "공지사항이 삭제되었습니다." });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: number; displayOrder: number }[]) => {
      return await apiRequest("PUT", "/api/notices/reorder", { updates });
    },
    onSuccess: () => {
      refetch();
      toast({ description: "순서가 변경되었습니다." });
    },
  });

  // 사이드 패널 핸들러
  const handleOpenAddPanel = () => {
    setSidePanelMode('add');
    setFormTitle("");
    setFormTag("노출");
    setFormContent("");
    setIsEditMode(false);
  };

  const handleRowClick = (notice: Notice) => {
    setSelectedNotice(notice);
    setSidePanelMode('detail');
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

    const data = {
      tag: formTag,
      title: formTitle,
      content: formContent,
    };

    if (sidePanelMode === 'add') {
      createMutation.mutate(data);
    } else if (sidePanelMode === 'detail' && selectedNotice) {
      updateMutation.mutate({ id: selectedNotice.id, data });
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

  // 드래그 종료 핸들러 (즉시 저장)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !allNotices) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageNotices = allNotices.slice(startIndex, endIndex);

    const oldIndex = pageNotices.findIndex((item) => item.id === active.id);
    const newIndex = pageNotices.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // 현재 페이지 내에서 재정렬
    const reordered = arrayMove(pageNotices, oldIndex, newIndex);
    
    // displayOrder 계산 (전역 인덱스 고려)
    const updates = reordered.map((notice, index) => ({
      id: notice.id,
      displayOrder: startIndex + index,
    }));

    // 즉시 저장
    reorderMutation.mutate(updates);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case "전체":
        return "bg-[#FFF3CD] text-[#956424]";
      case "우선":
        return "bg-[#FFF3CD] text-[#956424]";
      case "긴급":
        return "bg-[#FFF3CD] text-[#956424]";
      default:
        return "bg-[#FFF3CD] text-[#956424]";
    }
  };

  const notices = allNotices || [];
  const totalPages = Math.ceil(notices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentNotices = notices.slice(startIndex, endIndex);

  const SkeletonRow = () => (
    <div className="grid grid-cols-[8%_16%_46%_14%_16%] px-2 md:px-4 py-2 md:py-5 h-16 bg-white border-b border-[#E9E9E9] items-center animate-pulse">
      <div className="h-3 md:h-4 bg-[#E9E9E9] rounded w-6 md:w-8"></div>
      <div className="h-3 md:h-4 bg-[#E9E9E9] rounded w-14 md:w-20"></div>
      <div className="h-3 md:h-4 bg-[#E9E9E9] rounded w-3/4"></div>
      <div className="h-5 md:h-6 bg-[#E9E9E9] rounded w-10 md:w-12"></div>
      <div className="h-6 md:h-8 bg-[#E9E9E9] rounded w-10 md:w-12"></div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-3 md:mb-4 lg:mb-6" data-testid="breadcrumb">
        <span className="text-xs md:text-sm text-[#201E22]">공지 사항</span>
      </div>

      <h1
        className="text-lg md:text-xl lg:text-2xl font-semibold text-[#201E22] mb-3 md:mb-4 lg:mb-6 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img src={assets.adNoticeIcon} className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" alt="icon" /> 공지 사항
      </h1>

      {/* 탭 및 버튼 */}
      <div className="flex items-center justify-between mb-3 md:mb-4 lg:mb-6 border-b border-[#E9E9E9]">
        <div className="flex gap-4 md:gap-6 lg:gap-8">
          <div className="pb-2 md:pb-3 px-1 text-sm md:text-base font-medium border-b-2 border-[#E11936] text-[#E11936]">
            목록 {notices.length}건
            {reorderMutation.isPending && (
              <span className="ml-2 text-xs text-[#E11936]">저장 중...</span>
            )}
          </div>
        </div>
        <button
          onClick={handleOpenAddPanel}
          className="px-4 py-2 bg-[#E11936] text-white text-sm font-medium rounded hover:bg-[#C71530]"
          data-testid="button-add-notice"
        >
          + 공지사항 추가
        </button>
      </div>

      {/* 테이블 헤더 */}
      <div className="grid grid-cols-[8%_16%_46%_14%_16%] px-2 md:px-4 py-2 md:py-3 bg-[#F9F9F9] text-xs md:text-sm font-medium text-[#4D4B4E] mb-2">
        <div>No</div>
        <div>등록일</div>
        <div>제목</div>
        <div>상태</div>
        <div>관리</div>
      </div>

      {/* 테이블 바디 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: itemsPerPage }).map((_, index) => (
              <SkeletonRow key={index} />
            ))}
          </div>
        ) : currentNotices.length === 0 ? (
          <div className="flex items-center justify-center py-16 md:py-24 lg:py-32">
            <p className="text-sm md:text-base text-[#BFBFBF]">등록된 공지사항이 없습니다.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={currentNotices.map((n) => n.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0">
                {currentNotices.map((notice, index) => (
                  <SortableNoticeRow
                    key={notice.id}
                    notice={notice}
                    index={index}
                    formatDate={formatDate}
                    getTagColor={getTagColor}
                    handleDeleteClick={handleDeleteClick}
                    handleRowClick={() => handleRowClick(notice)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <AdminPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* 삭제 확인 팝업 */}
      {showDeleteConfirm && (
        <SimpleConfirmPopup
          message="해당 공지사항을 삭제하시겠어요?"
          leftButtonText="취소"
          rightButtonText="확인"
          onLeftClick={handleCancelDelete}
          onRightClick={handleConfirmDelete}
        />
      )}

      {/* 사이드 패널 오버레이 */}
      {sidePanelMode && (
        <div
          className="fixed inset-0 bg-black/50 z-[60]"
          onClick={handleCloseSidePanel}
        />
      )}

      {/* 사이드 패널 */}
      {sidePanelMode && (
        <div
          className="fixed right-0 top-0 h-full w-[800px] bg-white shadow-lg z-[70] flex flex-col animate-slide-in-right"
          style={{
            animation: "slideInRight 0.3s ease-out",
          }}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9E9E9]">
            <h2 className="text-lg font-semibold text-[#201E22]">
              {sidePanelMode === 'add' ? '공지사항 상세' : '공지사항 상세'}
            </h2>
            <button
              onClick={handleCloseSidePanel}
              className="text-[#BFBFBF] hover:text-[#201E22]"
              data-testid="button-close-panel"
            >
              <X size={24} />
            </button>
          </div>

          {/* 내용 */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* 제목 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#6B6B6B] mb-2">
                공지사항 제목
              </label>
              {sidePanelMode === 'add' || isEditMode ? (
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="제목을 입력해 주세요."
                  className="w-full px-4 py-3 border border-[#E9E9E9] rounded-lg text-sm text-[#201E22] placeholder:text-[#BFBFBF] focus:outline-none focus:border-[#E11936]"
                  data-testid="input-title"
                />
              ) : (
                <div className="text-base text-[#201E22] font-medium">
                  {selectedNotice?.title}
                </div>
              )}
            </div>

            {/* 부문 선택 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#6B6B6B] mb-2">
                부문 선택
              </label>
              {sidePanelMode === 'add' || isEditMode ? (
                <div className="flex gap-2">
                  {['노출', '보통', '중요', '긴급'].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setFormTag(tag)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formTag === tag
                          ? tag === '보통'
                            ? 'bg-[#FF0000] text-white'
                            : 'bg-[#E11936] text-white'
                          : 'bg-[#F7F7F7] text-[#6B6B6B] hover:bg-[#E9E9E9]'
                      }`}
                      data-testid={`button-tag-${tag}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <span
                    className={`px-3 py-1.5 rounded text-sm font-medium ${
                      selectedNotice?.tag === '보통'
                        ? 'bg-[#FF0000] text-white'
                        : 'bg-[#E11936] text-white'
                    }`}
                  >
                    {selectedNotice?.tag}
                  </span>
                </div>
              )}
            </div>

            {/* 내용 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#6B6B6B] mb-2">
                공지사항 내용
              </label>
              {sidePanelMode === 'add' || isEditMode ? (
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="내용을 입력해 주세요."
                  rows={12}
                  className="w-full px-4 py-3 border border-[#E9E9E9] rounded-lg text-sm text-[#201E22] placeholder:text-[#BFBFBF] focus:outline-none focus:border-[#E11936] resize-none"
                  data-testid="textarea-content"
                />
              ) : (
                <div className="text-sm text-[#201E22] whitespace-pre-wrap leading-relaxed">
                  {selectedNotice?.content}
                </div>
              )}
            </div>
          </div>

          {/* 푸터 버튼 */}
          <div className="px-6 py-4 border-t border-[#E9E9E9]">
            {sidePanelMode === 'add' ? (
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="w-full h-12 bg-black text-white rounded-lg font-medium hover:bg-[#2A2A2A] disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-submit"
              >
                {createMutation.isPending ? "등록 중..." : "등록하기"}
              </button>
            ) : isEditMode ? (
              <button
                onClick={handleSubmit}
                disabled={updateMutation.isPending}
                className="w-full h-12 bg-black text-white rounded-lg font-medium hover:bg-[#2A2A2A] disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-update"
              >
                {updateMutation.isPending ? "등록 중..." : "등록하기"}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditMode(true)}
                  className="flex-1 h-12 bg-[#F7F7F7] text-[#201E22] rounded-lg font-medium hover:bg-[#E9E9E9]"
                  data-testid="button-edit"
                >
                  수정하기
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 h-12 bg-black text-white rounded-lg font-medium hover:bg-[#2A2A2A]"
                  data-testid="button-submit"
                >
                  등록하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
