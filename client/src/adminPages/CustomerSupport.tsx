import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/adminQueryClient";
import AdminLayout from "./adminLayout";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminPagination from "./components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";
import { OpsPlatformTabs, type OpsPlatform } from "./ops/opsLoginStatusUi";
import { cn } from "@/lib/utils";

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
  dataSource?: string;
}

interface InquiryListResponse {
  data: InquiryData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pendingCount: number;
  resolvedCount: number;
  platform: OpsPlatform;
  counts: { ppamong: number; badminton9: number };
}

type StatusTab = "전체" | "답변 대기" | "답변 완료";

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${d} ${h}:${min}`;
}

function getStatusDisplay(status: string) {
  if (status === "pending") {
    return { text: "대기", className: "bg-[#FFF4E6] text-[#FF9800]" };
  }
  if (status === "resolved") {
    return { text: "완료", className: "bg-[#E8F5E9] text-[#4CAF50]" };
  }
  return { text: status, className: "bg-gray-100 text-gray-600" };
}

export default function CustomerSupportPage() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<OpsPlatform>("ppamong");
  const [activeTab, setActiveTab] = useState<StatusTab>("전체");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useResponsivePageSize();
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryData | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, platform, activeTab]);

  const queryKey = `/api/admin/inquiries?platform=${platform}&status=${activeTab}&page=${currentPage}&limit=${itemsPerPage}`;

  const { data, isLoading } = useQuery<InquiryListResponse>({
    queryKey: [queryKey],
    placeholderData: (previousData) => previousData,
  });

  const inquiries = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const pendingCount = data?.pendingCount ?? 0;
  const resolvedCount = data?.resolvedCount ?? 0;
  const totalCount = pendingCount + resolvedCount;
  const counts = data?.counts ?? { ppamong: 0, badminton9: 0 };

  const handleTabChange = (tab: StatusTab) => {
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

  const invalidateInquiries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/inquiries"] });
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, response }: { id: number; response: string }) => {
      return await apiRequest("PATCH", `/api/inquiries/${id}/status`, {
        status: "resolved",
        response,
      });
    },
    onSuccess: () => {
      invalidateInquiries();
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

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0 -mx-3 sm:-mx-4 md:-mx-5 lg:-mx-6 xl:-mx-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8">
          <p className="text-sm font-semibold text-[#201E22]" data-testid="page-title">
            문의 관리
          </p>
        </div>

        <div className="px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8 mb-3">
          <OpsPlatformTabs
            platform={platform}
            counts={counts}
            onChange={setPlatform}
            ppamongSublabel="빠몽 앱 문의"
            badminton9Sublabel="PG 레거시 (읽기 전용)"
            countLabel="건"
          />
        </div>

        <div className="flex gap-4 md:gap-6 border-b border-[#E9E9E9] mb-3 px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8">
          {(
            [
              { key: "전체" as const, count: totalCount },
              { key: "답변 대기" as const, count: pendingCount },
              { key: "답변 완료" as const, count: resolvedCount },
            ] as const
          ).map(({ key, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleTabChange(key)}
              className={cn(
                "pb-2 px-1 text-xs md:text-sm font-medium border-b-2 transition-colors",
                activeTab === key
                  ? "border-[#E11936] text-[#E11936]"
                  : "border-transparent text-[#BFBFBF]",
              )}
              data-testid={`tab-${key === "전체" ? "all" : key === "답변 대기" ? "pending" : "resolved"}`}
            >
              {key} {count}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto min-h-0 mx-3 sm:mx-4 md:mx-5 lg:mx-6 xl:mx-8 border border-[#E8E4F3] rounded-lg overflow-x-auto">
          {isLoading ? (
            <table className="w-full text-xs min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-[#F3F0FF] border-b border-[#E8E4F3] text-left text-[11px] text-[#6B5B95]">
                  {["No", "등록일", "제목", "이름", "ID", "카테고리", "상태", "관리"].map((col) => (
                    <th key={col} className="px-2 py-2 font-semibold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: itemsPerPage }).map((_, index) => (
                  <tr key={index} className="border-b border-[#F0F0F0] animate-pulse">
                    {Array.from({ length: 8 }).map((__, col) => (
                      <td key={col} className="px-2 py-2">
                        <div className="h-3 bg-[#E9E9E9] rounded" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : inquiries.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#BFBFBF]">
              {platform === "ppamong" ? "빠몽 문의가 없습니다." : "빠던9 레거시 문의가 없습니다."}
            </div>
          ) : (
            <table className="w-full text-xs min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-[#F3F0FF] border-b border-[#E8E4F3] text-left text-[11px] text-[#6B5B95]">
                  <th className="px-2 py-2 font-semibold whitespace-nowrap">No</th>
                  <th className="px-2 py-2 font-semibold whitespace-nowrap">등록일</th>
                  <th className="px-2 py-2 font-semibold whitespace-nowrap min-w-[160px]">제목</th>
                  <th className="px-2 py-2 font-semibold whitespace-nowrap">이름</th>
                  <th className="px-2 py-2 font-semibold whitespace-nowrap">ID</th>
                  <th className="px-2 py-2 font-semibold whitespace-nowrap">카테고리</th>
                  <th className="px-2 py-2 font-semibold whitespace-nowrap">상태</th>
                  <th className="px-2 py-2 font-semibold whitespace-nowrap w-14">관리</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inquiry, index) => {
                  const statusInfo = getStatusDisplay(inquiry.status);
                  return (
                    <tr
                      key={inquiry.id}
                      className="border-b border-[#EDE9F6]/80 hover:bg-[#FAFAFA] transition-colors"
                      data-testid={`inquiry-row-${index}`}
                    >
                      <td className="px-2 py-1.5 text-[#888] tabular-nums whitespace-nowrap">
                        #{inquiry.id}
                      </td>
                      <td className="px-2 py-1.5 text-[#666] tabular-nums whitespace-nowrap">
                        {formatDate(inquiry.createdAt)}
                      </td>
                      <td
                        className="px-2 py-1.5 text-[#201E22] max-w-[200px] truncate"
                        title={inquiry.title}
                      >
                        {inquiry.title}
                      </td>
                      <td className="px-2 py-1.5 text-[#414141] truncate max-w-[72px]" title={inquiry.userName}>
                        {inquiry.userName}
                      </td>
                      <td className="px-2 py-1.5 text-[#414141] truncate max-w-[72px]" title={inquiry.userUsername}>
                        {inquiry.userUsername}
                      </td>
                      <td className="px-2 py-1.5 text-[#414141] truncate max-w-[80px]" title={inquiry.category}>
                        {inquiry.category}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
                            statusInfo.className,
                          )}
                        >
                          {statusInfo.text}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleRowClick(inquiry)}
                          className="px-2 py-0.5 text-[10px] font-medium text-white bg-[#E11936] rounded hover:bg-[#C71530]"
                          data-testid={`button-manage-${index}`}
                        >
                          {platform === "ppamong" ? "답변" : "보기"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8 mt-3">
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {showSidePanel && selectedInquiry && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60] animate-in fade-in duration-300"
            onClick={handleCloseSidePanel}
          />

          <div className="fixed right-0 top-0 h-full w-full max-w-[800px] bg-white z-[70] shadow-xl overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-[#E9E9E9]">
              <h2 className="text-lg md:text-xl font-bold text-[#201E22]">문의 상세</h2>
              <button
                type="button"
                onClick={handleCloseSidePanel}
                className="text-[#BFBFBF] hover:text-[#201E22]"
                data-testid="button-close-panel"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-3 text-sm">
              <div className="grid grid-cols-[72px_1fr] gap-2 items-start">
                <span className="text-[#AAAAAA] font-semibold">제목</span>
                <span className="text-[#201E22]">{selectedInquiry.title}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid grid-cols-[72px_1fr] gap-2 items-center">
                  <span className="text-[#AAAAAA] font-semibold">카테고리</span>
                  <span className="text-[#201E22]">{selectedInquiry.category}</span>
                </div>
                <div className="grid grid-cols-[72px_1fr] gap-2 items-center">
                  <span className="text-[#AAAAAA] font-semibold">상태</span>
                  <span
                    className={cn(
                      "inline-flex w-fit px-2 py-0.5 rounded text-xs font-medium",
                      selectedInquiry.status === "pending"
                        ? "bg-[#FFF3CD] text-[#956424]"
                        : "bg-[#E8F5E9] text-[#4CAF50]",
                    )}
                  >
                    {selectedInquiry.status === "pending" ? "답변 대기" : "답변 완료"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-[72px_1fr] gap-2 items-start">
                <span className="text-[#AAAAAA] font-semibold">회원</span>
                <span className="text-[#201E22]">
                  {selectedInquiry.userName} ({selectedInquiry.userUsername})
                </span>
              </div>

              <div className="grid grid-cols-[72px_1fr] gap-2 items-center">
                <span className="text-[#AAAAAA] font-semibold">작성일</span>
                <span className="text-[#201E22]">{formatDate(selectedInquiry.createdAt)}</span>
              </div>

              <div className="border-t border-[#E9E9E9] pt-3">
                <p className="text-[#AAAAAA] font-semibold mb-2">문의 내용</p>
                <p className="text-[#201E22] whitespace-pre-wrap leading-relaxed min-h-[120px]">
                  {selectedInquiry.content}
                </p>
              </div>

              <div className="border-t border-[#E9E9E9] pt-3">
                <p className="text-[#201E22] font-semibold mb-2">답변</p>

                {!isEditMode && selectedInquiry.response && (
                  <div className="px-4 py-3 bg-[#F5F5F5] rounded min-h-[120px]">
                    <p className="text-[#201E22] whitespace-pre-wrap leading-relaxed">
                      {selectedInquiry.response}
                    </p>
                  </div>
                )}

                {platform === "ppamong" && isEditMode && (
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="답변을 입력하세요..."
                    className="w-full h-[160px] px-4 py-3 rounded text-sm text-[#201E22] placeholder-[#BFBFBF] border border-[#E9E9E9] focus:outline-none focus:border-[#E11936] resize-none"
                    data-testid="textarea-response"
                  />
                )}

                {platform === "ppamong" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditMode) {
                        handleSubmitResponse();
                      } else {
                        if (selectedInquiry?.response) {
                          setResponseText(selectedInquiry.response);
                        }
                        setIsEditMode(true);
                      }
                    }}
                    disabled={updateStatusMutation.isPending}
                    className="w-full h-11 mt-3 bg-[#201E22] text-white font-bold rounded hover:bg-[#3A3A3A] disabled:bg-[#BFBFBF] transition text-sm"
                  >
                    {updateStatusMutation.isPending
                      ? "처리 중..."
                      : isEditMode
                        ? "저장하기"
                        : selectedInquiry.status === "resolved"
                          ? "수정하기"
                          : "답변하기"}
                  </button>
                ) : (
                  <p className="mt-3 text-xs text-[#888]">빠던9 레거시 문의는 읽기 전용입니다.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
