import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/adminQueryClient";
import AdminLayout from "./adminLayout";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminPagination from "./components/AdminPagination";
import { useResponsivePageSize } from "@/hooks/useResponsivePageSize";
import { OpsPlatformTabs, type OpsPlatform } from "./ops/opsLoginStatusUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface InquiryData {
  id: number;
  category: string;
  title: string;
  content: string;
  status: string;
  response: string | null;
  createdAt: string;
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

export default function CustomerSupportPage() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<OpsPlatform>("ppamong");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = useResponsivePageSize();
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryData | null>(null);
  const [sidePanelMode, setSidePanelMode] = useState<SidePanelMode>(null);
  const [formCategory, setFormCategory] = useState("일반");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formResponse, setFormResponse] = useState("");

  const canEdit = platform === "ppamong";

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, platform]);

  const queryKey = `/api/admin/inquiries?platform=${platform}&page=${currentPage}&limit=${itemsPerPage}${
    platform === "badminton9" ? "&status=전체" : ""
  }`;

  const { data, isLoading } = useQuery<InquiryListResponse>({
    queryKey: [queryKey],
    queryFn: async () => {
      const res = await apiRequest("GET", queryKey);
      return res.json();
    },
    placeholderData: (previousData) => previousData,
  });

  const inquiries = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const counts = data?.counts ?? { ppamong: 0, badminton9: 0 };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/inquiries"] });
    queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        category: formCategory.trim(),
        title: formTitle.trim(),
        content: formContent.trim(),
        response: formResponse.trim(),
      };
      if (sidePanelMode === "add") {
        return apiRequest("POST", "/api/admin/inquiries", payload);
      }
      if (sidePanelMode === "edit" && selectedInquiry) {
        return apiRequest("PATCH", `/api/admin/inquiries/${selectedInquiry.id}`, payload);
      }
      throw new Error("invalid mode");
    },
    onSuccess: () => {
      invalidate();
      handleCloseSidePanel();
      toast({ description: sidePanelMode === "add" ? "문의 안내가 등록되었습니다." : "문의 안내가 수정되었습니다." });
    },
    onError: () => {
      toast({ variant: "destructive", description: "저장에 실패했습니다." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/inquiries/${id}`),
    onSuccess: () => {
      invalidate();
      handleCloseSidePanel();
      toast({ description: "문의 안내가 삭제되었습니다." });
    },
    onError: () => {
      toast({ variant: "destructive", description: "삭제에 실패했습니다." });
    },
  });

  const handleOpenAdd = () => {
    setSelectedInquiry(null);
    setFormCategory("일반");
    setFormTitle("");
    setFormContent("");
    setFormResponse("");
    setSidePanelMode("add");
  };

  const handleOpenEdit = (inquiry: InquiryData) => {
    setSelectedInquiry(inquiry);
    setFormCategory(inquiry.category);
    setFormTitle(inquiry.title);
    setFormContent(inquiry.content);
    setFormResponse(inquiry.response ?? "");
    setSidePanelMode("edit");
  };

  const handleOpenDetail = (inquiry: InquiryData) => {
    setSelectedInquiry(inquiry);
    setSidePanelMode("detail");
  };

  const handleCloseSidePanel = () => {
    setSidePanelMode(null);
    setSelectedInquiry(null);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0 -mx-3 sm:-mx-4 md:-mx-5 lg:-mx-6 xl:-mx-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8">
          <p className="text-sm font-semibold text-[#201E22]" data-testid="page-title">
            문의 관리
          </p>
          {canEdit ? (
            <Button
              size="sm"
              className="h-8 text-xs bg-[#E57373] hover:bg-[#EF5350]"
              onClick={handleOpenAdd}
              data-testid="button-add-inquiry-faq"
            >
              + 문의 안내 추가
            </Button>
          ) : null}
        </div>

        <div className="px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8 mb-3">
          <OpsPlatformTabs
            platform={platform}
            counts={counts}
            onChange={setPlatform}
            ppamongSublabel="빠몽 앱 문의 FAQ"
            badminton9Sublabel="PG 레거시 (읽기 전용)"
            countLabel="건"
          />
        </div>

        <div className="flex-1 overflow-auto min-h-0 mx-3 sm:mx-4 md:mx-5 lg:mx-6 xl:mx-8 border border-[#E8E4F3] rounded-lg overflow-x-auto">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-[#BFBFBF]">불러오는 중...</div>
          ) : inquiries.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#BFBFBF]">
              {platform === "ppamong" ? "빠몽 문의 안내가 없습니다." : "빠던9 레거시 문의가 없습니다."}
            </div>
          ) : (
            <table className="w-full text-xs min-w-[640px] border-collapse">
              <thead>
                <tr className="bg-[#F3F0FF] border-b border-[#E8E4F3] text-left text-[11px] text-[#6B5B95]">
                  <th className="px-2 py-2 font-semibold whitespace-nowrap">No</th>
                  <th className="px-2 py-2 font-semibold whitespace-nowrap">등록일</th>
                  <th className="px-2 py-2 font-semibold whitespace-nowrap min-w-[160px]">제목</th>
                  <th className="px-2 py-2 font-semibold whitespace-nowrap">카테고리</th>
                  <th className="px-2 py-2 font-semibold whitespace-nowrap w-24">관리</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inquiry, index) => (
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
                      className="px-2 py-1.5 text-[#201E22] max-w-[200px] truncate cursor-pointer"
                      title={inquiry.title}
                      onClick={() => handleOpenDetail(inquiry)}
                    >
                      {inquiry.title}
                    </td>
                    <td className="px-2 py-1.5 text-[#414141] truncate max-w-[80px]" title={inquiry.category}>
                      {inquiry.category}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {canEdit ? (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(inquiry)}
                            className="px-2 py-0.5 text-[10px] font-medium text-white bg-[#4285F4] rounded hover:bg-[#3367D6]"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(inquiry.id)}
                            className="px-2 py-0.5 text-[10px] font-medium text-white bg-[#E57373] rounded hover:bg-[#EF5350]"
                          >
                            삭제
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(inquiry)}
                          className="px-2 py-0.5 text-[10px] font-medium text-white bg-[#4285F4] rounded hover:bg-[#3367D6]"
                        >
                          보기
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
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

      {sidePanelMode && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={handleCloseSidePanel} />
          <div className="fixed right-0 top-0 h-full w-full max-w-[800px] bg-white z-[70] shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-[#E9E9E9]">
              <h2 className="text-lg md:text-xl font-bold text-[#201E22]">
                {sidePanelMode === "add"
                  ? "문의 안내 추가"
                  : sidePanelMode === "edit"
                    ? "문의 안내 수정"
                    : "문의 안내 상세"}
              </h2>
              <button type="button" onClick={handleCloseSidePanel} className="text-[#BFBFBF] hover:text-[#201E22]">
                <X size={24} />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-4 text-sm">
              {sidePanelMode === "detail" && selectedInquiry ? (
                <>
                  <div className="grid grid-cols-[72px_1fr] gap-2">
                    <span className="text-[#AAAAAA] font-semibold">제목</span>
                    <span>{selectedInquiry.title}</span>
                  </div>
                  <div className="grid grid-cols-[72px_1fr] gap-2">
                    <span className="text-[#AAAAAA] font-semibold">카테고리</span>
                    <span>{selectedInquiry.category}</span>
                  </div>
                  <div className="border-t border-[#E9E9E9] pt-3">
                    <p className="text-[#AAAAAA] font-semibold mb-2">내용</p>
                    <p className="whitespace-pre-wrap leading-relaxed">{selectedInquiry.content}</p>
                  </div>
                  {selectedInquiry.response ? (
                    <div className="border-t border-[#E9E9E9] pt-3">
                      <p className="text-[#AAAAAA] font-semibold mb-2">답변</p>
                      <p className="whitespace-pre-wrap leading-relaxed">{selectedInquiry.response}</p>
                    </div>
                  ) : null}
                </>
              ) : canEdit ? (
                <>
                  <div>
                    <label className="text-xs text-[#888] mb-1 block">카테고리</label>
                    <Input value={formCategory} onChange={(e) => setFormCategory(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-[#888] mb-1 block">제목</label>
                    <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-[#888] mb-1 block">문의 내용</label>
                    <Textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      className="min-h-[120px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#888] mb-1 block">답변</label>
                    <Textarea
                      value={formResponse}
                      onChange={(e) => setFormResponse(e.target.value)}
                      className="min-h-[120px]"
                    />
                  </div>
                  <Button
                    className={cn("w-full bg-[#201E22] hover:bg-[#3A3A3A]")}
                    disabled={
                      saveMutation.isPending ||
                      !formCategory.trim() ||
                      !formTitle.trim() ||
                      !formContent.trim() ||
                      !formResponse.trim()
                    }
                    onClick={() => saveMutation.mutate()}
                  >
                    {saveMutation.isPending ? "저장 중..." : "저장하기"}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
