import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/adminQueryClient";
import AdminLayout from "./adminLayout";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminPagination from "./components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";

interface InquiryData {
  id: number;
  userId: string;
  category: string;
  title: string;
  content: string;
  status: string;
  response: string | null;
  createdAt: string;
  userName: string;
  userUsername: string;
  userEmail: string;
}

interface InquiryListResponse {
  data: InquiryData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pendingCount: number;
  resolvedCount: number;
}

export default function CustomerSupportPage() {
  const { assets } = useAdminAssets();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"전체" | "답변 대기" | "답변 완료">("전체");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useResponsivePageSize();
  useEffect(() => { setCurrentPage(1); }, [itemsPerPage]);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryData | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);

  const { data, isLoading } = useQuery<InquiryListResponse>({
    queryKey: [`/api/admin/inquiries?status=${activeTab}&page=${currentPage}&limit=${itemsPerPage}`],
    placeholderData: (previousData) => previousData,
  });

  const inquiries = data?.data || [];
  const totalPages = data?.totalPages || 1;
  const pendingCount = data?.pendingCount || 0;
  const resolvedCount = data?.resolvedCount || 0;
  const totalCount = pendingCount + resolvedCount;

  const handleTabChange = (tab: "전체" | "답변 대기" | "답변 완료") => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleRowClick = (inquiry: InquiryData) => {
    setSelectedInquiry(inquiry);
    setShowSidePanel(true);
    if (inquiry.status === "resolved" && inquiry.response) {
      setResponseText(inquiry.response);
      setIsEditMode(false);
    } else {
      setResponseText("");
      setIsEditMode(true);
    }
  };

  const handleCloseSidePanel = () => {
    setShowSidePanel(false);
    setSelectedInquiry(null);
    setResponseText("");
    setIsEditMode(false);
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, response }: { id: number; response: string }) => {
      return await apiRequest("PATCH", `/api/inquiries/${id}/status`, {
        status: "resolved",
        response,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/admin/inquiries?status=${activeTab}&page=${currentPage}&limit=${itemsPerPage}`],
      });
      handleCloseSidePanel();
      toast({ description: "답변이 완료되었습니다." });
    },
  });

  const handleSubmitResponse = () => {
    if (!selectedInquiry) return;
    if (!responseText.trim()) {
      toast({ variant: "destructive", description: "답변을 입력해주세요." });
      return;
    }
    updateStatusMutation.mutate({ id: selectedInquiry.id, response: responseText });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}. ${month}. ${day}. 오후 ${hours}:${minutes}`;
  };

  const getStatusDisplay = (status: string) => {
    if (status === "pending") {
      return { text: "답변 대기", className: "bg-[#FFF4E6] text-[#FF9800]" };
    } else if (status === "resolved") {
      return { text: "답변 완료", className: "bg-[#E8F5E9] text-[#4CAF50]" };
    }
    return { text: status, className: "bg-gray-100 text-gray-600" };
  };

  function SkeletonRow() {
    return (
      <div className="grid grid-cols-[8%_16%_12%_10%_12%_10%_16%_16%] px-2 md:px-4 py-2 md:py-5 bg-white border-b border-[#E9E9E9] items-center h-16">
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-8 md:w-12 animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-20 md:w-32 animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-12 md:w-16 animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-8 md:w-12 animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-14 md:w-20 animate-pulse" />
        <div className="h-5 md:h-6 bg-[#E9E9E9] rounded w-12 md:w-16 animate-pulse" />
        <div className="h-3 md:h-3.5 bg-[#E9E9E9] rounded w-16 md:w-24 animate-pulse" />
        <div className="h-5 md:h-6 bg-[#E9E9E9] rounded w-12 md:w-16 animate-pulse" />
      </div>
    );
  }

  return (
    <AdminLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-3 md:mb-4 lg:mb-6" data-testid="breadcrumb">
        <span className="text-xs md:text-sm text-[#201E22]">문의 관리</span>
      </div>

      {/* Page Title */}
      <h1
        className="text-lg md:text-xl lg:text-2xl font-semibold text-[#201E22] mb-3 md:mb-4 lg:mb-6 flex items-center gap-2"
        data-testid="page-title"
      >
        <img src={assets.adListIcon} className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" alt="icon" /> 문의 관리
      </h1>

      {/* 탭 */}
      <div className="flex gap-4 md:gap-6 lg:gap-8 border-b border-[#E9E9E9] mb-3 md:mb-4 lg:mb-6">
        <button
          onClick={() => handleTabChange("전체")}
          className={`pb-2 md:pb-3 px-1 text-sm md:text-base font-medium border-b-2 transition-colors ${
            activeTab === "전체"
              ? "border-[#E11936] text-[#E11936]"
              : "border-transparent text-[#BFBFBF]"
          }`}
          data-testid="tab-all"
        >
          전체 {totalCount}
        </button>
        <button
          onClick={() => handleTabChange("답변 대기")}
          className={`pb-2 md:pb-3 px-1 text-sm md:text-base font-medium border-b-2 transition-colors ${
            activeTab === "답변 대기"
              ? "border-[#E11936] text-[#E11936]"
              : "border-transparent text-[#BFBFBF]"
          }`}
          data-testid="tab-pending"
        >
          답변 대기 {pendingCount}
        </button>
        <button
          onClick={() => handleTabChange("답변 완료")}
          className={`pb-2 md:pb-3 px-1 text-sm md:text-base font-medium border-b-2 transition-colors ${
            activeTab === "답변 완료"
              ? "border-[#E11936] text-[#E11936]"
              : "border-transparent text-[#BFBFBF]"
          }`}
          data-testid="tab-resolved"
        >
          답변 완료 {resolvedCount}
        </button>
      </div>

      {/* 테이블 헤더 */}
      <div className="grid grid-cols-[8%_16%_12%_10%_12%_10%_16%_16%] px-2 md:px-4 py-2 md:py-3 bg-[#F9F9F9] text-xs md:text-sm font-medium text-[#4D4B4E] mb-2">
        <div>문의 번호</div>
        <div>제목</div>
        <div>이름</div>
        <div>ID</div>
        <div>카테고리</div>
        <div>상태</div>
        <div>등록일</div>
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
          ) : inquiries.length === 0 ? (
            <div className="flex items-center justify-center py-16 md:py-24 lg:py-32">
              <p className="text-sm md:text-base text-[#BFBFBF]">조회된 문의가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {inquiries.map((inquiry, index) => {
                const statusInfo = getStatusDisplay(inquiry.status);
                return (
                  <div
                    key={inquiry.id}
                    className="grid grid-cols-[8%_16%_12%_10%_12%_10%_16%_16%] px-2 md:px-4 h-16 bg-white border-b border-[#E9E9E9] items-center text-xs md:text-sm text-[#201E22]"
                    data-testid={`inquiry-row-${index}`}
                  >
                    <div className="text-[#414141]">{inquiry.id}</div>
                    <div className="truncate text-[#414141]" title={inquiry.title}>
                      {inquiry.title}
                    </div>
                    <div className="truncate text-[#414141]" title={inquiry.userName}>
                      {inquiry.userName}
                    </div>
                    <div className="truncate text-[#414141]" title={inquiry.userUsername}>
                      {inquiry.userUsername}
                    </div>
                    <div className="truncate text-[#414141]" title={inquiry.category}>
                      {inquiry.category}
                    </div>
                    <div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.className}`}
                      >
                        {statusInfo.text}
                      </span>
                    </div>
                    <div className="text-[#414141] text-xs">
                      {formatDate(inquiry.createdAt)}
                    </div>
                    <div>
                      <button
                        onClick={() => handleRowClick(inquiry)}
                        className="px-2 md:px-3 py-1 text-[10px] md:text-xs font-medium text-white bg-[#E11936] rounded hover:bg-[#C71530]"
                        data-testid={`button-manage-${index}`}
                      >
                        답변
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      <AdminPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* 사이드 패널 */}
      {showSidePanel && selectedInquiry && (
        <>
          {/* 오버레이 */}
          <div
            className="fixed inset-0 bg-black/50 z-[60] animate-in fade-in duration-300"
            onClick={handleCloseSidePanel}
          />

          {/* 사이드 패널 콘텐츠 */}
          <div className="fixed right-0 top-0 h-full w-[800px] bg-white z-[70] shadow-xl overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-[#E9E9E9]">
              <h2 className="text-xl font-bold text-[#201E22]">
                문의 상세 정보
              </h2>
              <button
                onClick={handleCloseSidePanel}
                className="text-[#BFBFBF] hover:text-[#201E22]"
                data-testid="button-close-panel"
              >
                <X size={24} />
              </button>
            </div>

            {/* 문의 정보 */}
            <div className="p-2 space-y-2.5">
              {/* 문의 제목 */}
              <div className="flex flex-row items-center px-5 py-4 gap-2.5 rounded ">
                <div className="flex flex-row items-start gap-2.5 flex-1">
                  <span className="text-sm font-semibold text-[#AAAAAA] w-[54px]">
                    문의 제목
                  </span>
                  <span className="text-base text-[#201E22] flex-1">
                    {selectedInquiry.title}
                  </span>
                </div>
              </div>

              {/* 카테고리 & 상태 */}
              <div className="flex flex-row items-start gap-4">
                <div className="flex flex-row items-center px-5 py-4 gap-2.5 rounded flex-1">
                  <div className="flex flex-row items-start gap-2.5 flex-1">
                    <span className="text-sm font-semibold text-[#AAAAAA] w-[54px]">
                      카테고리
                    </span>
                    <span className="text-base text-[#201E22]">
                      {selectedInquiry.category}
                    </span>
                  </div>
                </div>
                <div className="flex flex-row items-center px-5 py-4 gap-2.5 rounded flex-1">
                  <div className="flex flex-row items-center gap-2.5 flex-1">
                    <span className="text-sm font-semibold text-[#AAAAAA] w-[54px]">
                      상태
                    </span>
                    <span
                      className={`px-2.5 py-1.5 rounded text-sm font-medium ${
                        selectedInquiry.status === "pending"
                          ? "bg-[#FFF3CD] text-[#956424]"
                          : "bg-[#E8F5E9] text-[#4CAF50]"
                      }`}
                    >
                      {selectedInquiry.status === "pending" ? "답변 대기" : "답변 완료"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 작성일 */}
              <div className="flex flex-row items-center px-5 py-4 gap-2.5 rounded ">
                <div className="flex flex-row items-start gap-2.5 flex-1">
                  <span className="text-sm font-semibold text-[#AAAAAA] w-[54px]">
                    작성일
                  </span>
                  <span className="text-base text-[#201E22]">
                    {formatDate(selectedInquiry.createdAt)}
                  </span>
                </div>
              </div>

              {/* 문의 내용 */}
              <div className="border-b border-[#E9E9E9] pb-2.5">
                <div className="flex flex-row items-start px-5 py-4 gap-2.5 rounded  min-h-[200px]">
                  <div className="flex flex-col gap-2.5 flex-1">
                    <span className="text-sm font-semibold text-[#AAAAAA]">
                      문의 내용
                    </span>
                    <p className="text-base text-[#201E22] whitespace-pre-wrap leading-relaxed">
                      {selectedInquiry.content}
                    </p>
                  </div>
                </div>
              </div>

              {/* 답변 섹션 */}
            <div className="pt-2.5">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between px-5">
                  <label className="text-sm font-semibold text-[#201E22]">답변</label>
                </div>

                {/* 답변 내용 표시 (수정 모드가 아니고 답변이 있을 때) */}
                {!isEditMode && selectedInquiry.response && (
                  <div className="px-5 py-4 bg-[#F5F5F5] rounded min-h-[200px]">
                    <p className="text-base text-[#201E22] whitespace-pre-wrap leading-relaxed">
                      {selectedInquiry.response}
                    </p>
                  </div>
                )}

                {/* 답변 입력란 (수정 모드일 때) */}
                {isEditMode && (
                  <>
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="답변을 입력하세요..."
                      className="w-full h-[200px] px-5 py-4 rounded text-base text-[#201E22] placeholder-[#BFBFBF] border border-[#E9E9E9] focus:outline-none focus:border-[#E11936] resize-none"
                      data-testid="textarea-response"
                    />
                  </>
                )}

                {/* 하단 버튼 */}
                <button
                  onClick={() => {
                    if (isEditMode) {
                      handleSubmitResponse();
                    } else {
                      // 수정 모드로 전환 시 기존 답변 내용을 textarea에 넣기
                      if (selectedInquiry?.response) {
                        setResponseText(selectedInquiry.response);
                      }
                      setIsEditMode(true);
                    }
                  }}
                  disabled={updateStatusMutation.isPending}
                  className="w-full h-12 bg-[#201E22] text-white font-bold rounded hover:bg-[#3A3A3A] disabled:bg-[#BFBFBF] transition mt-2"
                >
                  {updateStatusMutation.isPending
                    ? "처리 중..."
                    : isEditMode
                    ? "저장하기"
                    : selectedInquiry.status === "resolved"
                    ? "수정하기"
                    : "답변하기"}
                </button>

              </div>
            </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
