import { useLocation } from "wouter";
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

export default function NoticePage() {
  const [, setLocation] = useLocation();

  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ["/api/notices"],
    refetchOnMount: "always",
  });

  return (
    <div className="h-app-screen bg-[#111111]">
      {/* 헤더 */}
      <PageHeader />

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-scroll-touch px-5 pt-[10px] pb-bottom-nav-with-bar">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">공지사항</h1>
        {isLoading ? (
          // 로딩 스켈레톤
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-full h-[80px] bg-[#1A1A1A] rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : notices.length > 0 ? (
          // 공지사항 리스트
          <div className="flex flex-col gap-3">
            {notices.map((notice) => (
              <button
                key={notice.id}
                onClick={() => setLocation(`/notice/${notice.id}`)}
                className="relative w-full h-[96px] bg-[#1C1F20] rounded-[10px] p-4 text-left hover:shadow-md transition-shadow overflow-hidden focus:outline-none focus-visible:outline-none"
                data-testid={`notice-${notice.id}`}
              >
                {/* 배경 Ellipse */}
                <div
                  className="absolute w-[223px] h-[223px] left-[-134px] top-[-183px] bg-[rgba(253,224,71,0.5)] blur-[50px] rounded-full z-0"
                  aria-hidden="true"
                />

                <div className="flex flex-col gap-[14px] relative z-10">
                  {/* 태그 */}
                  <div className="flex gap-[10px]">
                    <div>
                      <span
                        className={`inline-flex items-center justify-center min-w-[42px] h-[21px] px-2 py-[2px] rounded-[3px] text-[12px] font-bold whitespace-nowrap ${getTagStyle(notice.tag)}`}
                        data-testid={`notice-tag-${notice.id}`}
                      >
                        {notice.tag}
                      </span>

                    </div>

                    {/* 제목 */}
                    <h3
                      className="flex-1 min-w-0 text-[16px] font-semibold text-[#E9E9E9] truncate leading-[140%]"
                      data-testid={`notice-title-${notice.id}`}
                    >
                      {notice.title}
                    </h3>
                  </div>

                  {/* 날짜 */}
                  <p
                    className="w-full text-[15px] font-normal text-[#BFBFBF] leading-[140%]"
                    data-testid={`notice-date-${notice.id}`}
                  >
                    작성일:{" "}
                    {format(new Date(notice.createdAt), "yyyy.MM.dd HH:mm")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          // 빈 상태
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <p className="text-[#6B6B6B] text-sm">공지사항이 없습니다.</p>
          </div>
        )}
      </div>
      <BottomNavigation />
    </div>
  );
}
