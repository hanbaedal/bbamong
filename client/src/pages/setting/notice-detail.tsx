import { useLocation, useParams } from "wouter";
import { ChevronLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

type Notice = {
  id: number;
  tag: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

const getTagStyle = (tag: string) => {
  switch (tag) {
    case "긴급":
      return "bg-[#E11936] text-white";
    case "우선":
      return "bg-[#FDE047] text-black";
    case "보통":
      return "bg-[#373539] text-white";
    default:
      return "bg-[#6B6B6B] text-white";
  }
};

export default function NoticeDetailPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const noticeId = params.id;

  const { data: notice, isLoading } = useQuery<Notice>({
    queryKey: ["/api/notices", noticeId],
    enabled: !!noticeId,
    refetchOnMount: "always",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="animate-pulse text-[#6B6B6B]">로딩 중...</div>
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="text-[#6B6B6B]">공지사항을 찾을 수 없습니다.</div>
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
      />

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-scroll-touch pt-[10px] pb-bottom-nav">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">공지사항 상세</h1>
        <div className="px-5 py-5">
          {/* 태그 & 날짜 */}
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getTagStyle(
                notice.tag
              )}`}
              data-testid="notice-tag"
            >
              {notice.tag}
            </span>
            <span className="text-[#BFBFBF] text-sm" data-testid="notice-date">
              {format(new Date(notice.createdAt), "yyyy.MM.dd HH:mm")}
            </span>
          </div>

          {/* 제목 */}
          <h2
            className="text-white text-lg font-semibold mb-6 leading-[140%] border-b border-[#373539] pb-[10px]"
            data-testid="notice-title"
          >
            {notice.title}
          </h2>

          {/* 내용 */}
          <div
            className="text-[#D5D5D5] text-[15px] leading-[160%] whitespace-pre-wrap"
            data-testid="notice-content"
          >
            {notice.content}
          </div>
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
}
