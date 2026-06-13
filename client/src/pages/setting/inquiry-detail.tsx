import { useLocation, useParams } from "wouter";
import { ChevronLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useUserAssets } from "@/contexts/UserAssetContext"

type InquiryDetail = {
  id: number;
  userId: string;
  category: string;
  title: string;
  content: string;
  status: string;
  response?: string | null;
  createdAt: string;
  userName: string;
};

export default function InquiryDetailPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const inquiryId = params.id;
  const { assets } = useUserAssets()
  const { data: inquiry, isLoading } = useQuery<InquiryDetail>({
    queryKey: ["/api/inquiries", inquiryId],
    enabled: !!inquiryId,
    refetchOnMount: "always",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="animate-pulse text-[#6B6B6B]">로딩 중...</div>
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="text-[#6B6B6B]">문의를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="h-app-screen bg-[#111111]">
      {/* 헤더 */}
      <PageHeader
        leftAction={
          <button
            onClick={() => setLocation("/settings")}
            data-testid="button-back"
            className="p-1 focus:outline-none focus-visible:outline-none"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
        borderBottom
      />

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-scroll-touch pt-[10px] pb-bottom-nav">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">문의 상세</h1>
        <div className="px-5 py-5">
          {/* 카테고리 & 날짜 */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#BFBFBF] text-sm" data-testid="inquiry-category">
              {inquiry.category}
            </span>
            <span className="text-[#6B6B6B] text-sm">·</span>
            <span className="text-[#BFBFBF] text-sm" data-testid="inquiry-date">
              {format(new Date(inquiry.createdAt), "yyyy.MM.dd HH:mm")}
            </span>
          </div>

          {/* 제목 */}
          <h2
            className="text-white text-lg font-semibold mb-4 leading-[140%]"
            data-testid="inquiry-title"
          >
            {inquiry.title}
          </h2>

          {/* 내용 */}
          <div
            className="text-[#D5D5D5] text-[15px] leading-[160%] whitespace-pre-wrap mb-8 border-b border-[#373539] pb-[10px]"
            data-testid="inquiry-content"
          >
            {inquiry.content}
          </div>

          {/* 답변 내역 섹션 */}
          <div className="mt-8">
            <h3 className="text-white text-base font-semibold mb-4">답변 내역</h3>

            {inquiry.response ? (
              // 답변이 있는 경우
              <div className="bg-[#1C1F20] rounded-lg p-5">
                <div
                  className="text-[#E9E9E9] text-[15px] leading-[160%] whitespace-pre-wrap"
                  data-testid="inquiry-response"
                >
                  {inquiry.response}
                </div>
              </div>
            ) : (
              // 답변이 없는 경우
              <div className="flex flex-col items-center justify-center py-10">
                <img
                  src={assets.noCommentImg}
                  alt="답변 없음"
                  className="w-[150px] h-[150px] mb-4 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  data-testid="img-no-reply"
                />
                <p className="text-[#6B6B6B] text-sm" data-testid="text-no-reply">
                  도착한 답변이 없습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
}
