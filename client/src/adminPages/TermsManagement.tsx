import { useState, useEffect } from "react";
import AdminLayout from "./adminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/adminQueryClient";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useToast } from "@/hooks/use-toast";

type TermType = "service" | "privacy" | "qna" | "operator";

interface Term {
  id?: number;
  type: string;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

const termTypeLabels: Record<TermType, string> = {
  service: "서비스 이용약관",
  privacy: "개인정보 처리방침",
  qna: "Q&A",
  operator: "운영자 약관",
};

export default function TermsManagementPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TermType>("service");
  const [content, setContent] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { assets } = useAdminAssets();
  const { toast } = useToast();
  const { data: termData, isLoading } = useQuery<Term>({
    queryKey: ["/api/terms/type", activeTab],
  });

  useEffect(() => {
    if (termData) {
      setContent(termData.content || "");
    }
  }, [termData]);

  const saveMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      return await apiRequest("PUT", `/api/terms/type/${activeTab}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terms/type", activeTab] });
      toast({ description: "약관이 저장되었습니다." });
      setErrorMessage("");
    },
    onError: (error: any) => {
      setErrorMessage(error.message || "저장에 실패했습니다.");
    },
  });

  const handleSave = () => {
    if (!content.trim()) {
      setErrorMessage("내용을 입력해주세요.");
      return;
    }

    setErrorMessage("");
    saveMutation.mutate({
      title: termTypeLabels[activeTab],
      content: content,
    });
  };

  const handleTabChange = (tab: TermType) => {
    setActiveTab(tab);
  };

  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-6" data-testid="breadcrumb">
        <span className="text-sm text-[#201E22]">약관 관리</span>
      </div>

      <h1
        className="text-2xl font-semibold text-[#201E22] mb-6 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img src={assets.adNoticeIcon} className="w-8 h-8" alt="icon" /> 약관 관리
      </h1>

      <div className="bg-white rounded-lg flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* 탭 헤더 */}
        <div className="flex items-center justify-between border-b border-[#E9E9E9]">
          <div className="flex">
            {(Object.keys(termTypeLabels) as TermType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleTabChange(type)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === type
                    ? "border-[#E11936] text-[#E11936]"
                    : "border-transparent text-[#BFBFBF] hover:text-[#201E22]"
                }`}
                data-testid={`tab-${type}`}
              >
                {termTypeLabels[type]}
              </button>
            ))}
          </div>
          <div className="px-6">
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-4 py-2 bg-[#E11936] text-white text-sm font-medium rounded hover:bg-[#C71530] disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-save"
            >
              {saveMutation.isPending ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>

        {/* 내용 영역 */}
        <div className="py-4 flex-1 min-h-0 flex flex-col">

          {isLoading ? (
            <div className="px-4 flex-1 min-h-0">
              <div className="w-full h-full min-h-[200px] border border-[#E9E9E9] rounded-lg p-4 space-y-3">
                <div className="h-4 w-3/4 bg-[#F5F5F5] rounded animate-pulse"></div>
                <div className="h-4 w-full bg-[#F5F5F5] rounded animate-pulse"></div>
                <div className="h-4 w-5/6 bg-[#F5F5F5] rounded animate-pulse"></div>
                <div className="h-4 w-4/5 bg-[#F5F5F5] rounded animate-pulse"></div>
                <div className="h-4 w-full bg-[#F5F5F5] rounded animate-pulse"></div>
                <div className="h-4 w-2/3 bg-[#F5F5F5] rounded animate-pulse"></div>
                <div className="h-4 w-full bg-[#F5F5F5] rounded animate-pulse"></div>
                <div className="h-4 w-3/4 bg-[#F5F5F5] rounded animate-pulse"></div>
                <div className="h-4 w-5/6 bg-[#F5F5F5] rounded animate-pulse"></div>
                <div className="h-4 w-4/5 bg-[#F5F5F5] rounded animate-pulse"></div>
              </div>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="약관 내용을 입력해주세요."
              className="w-full flex-1 min-h-[200px] px-4 py-3 border border-[#E9E9E9] rounded-lg text-sm text-[#201E22] placeholder:text-[#BFBFBF] focus:outline-none focus:border-[#E11936] resize-none font-mono leading-relaxed"
              data-testid="textarea-content"
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
