import { useState } from "react";
import { useLocation } from "wouter";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";

type Inquiry = {
  id: number;
  userId: string;
  category: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  userName: string;
};

const getStatusText = (status: string) => {
  switch (status) {
    case "pending":
      return "답변 대기중";
    case "in_progress":
      return "답변 진행중";
    case "resolved":
      return "답변 완료";
    default:
      return "답변 대기중";
  }
};

export default function CustomerCenterPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"inquiry" | "answered">("inquiry");
  const { assets } = useUserAssets();
  const { user, isGuest } = useUser();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);

  const { data: allInquiries = [], isLoading } = useQuery<Inquiry[]>({
    queryKey: ["inquiries", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await apiRequest("GET", `/api/inquiries?userId=${user.id}`);
      return await res.json() as Inquiry[];
    },
    enabled: !!user?.id,
    refetchOnMount: "always",
    staleTime: 0,
  });

  // 탭에 따라 필터링
  const inquiries = activeTab === "answered"
    ? allInquiries.filter(inquiry => inquiry.status === "resolved")
    : allInquiries;

  return (
    <div className="h-app-screen bg-[#111111]">
      {/* 헤더 */}
      <PageHeader />

      {/* 컨텐츠 */}
      <div className="flex-1 flex flex-col pt-[10px] overflow-y-scroll-touch pb-bottom-nav">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">고객센터</h1>

        {/* 탭 */}
        <div className="flex px-5">
          <button
            onClick={() => setActiveTab("inquiry")}
            className={`flex-1 py-3 text-base font-medium transition-colors ${
              activeTab === "inquiry"
                ? "text-white border-b-2 border-[#E11937]"
                : "text-[#6B6B6B]"
            }`}
            data-testid="tab-inquiry"
          >
            문의 내역
          </button>
          <button
            onClick={() => setActiveTab("answered")}
            className={`flex-1 py-3 text-base font-medium transition-colors ${
              activeTab === "answered"
                ? "text-white border-b-2 border-[#E11937]"
                : "text-[#6B6B6B]"
            }`}
            data-testid="tab-answered"
          >
            답변 받은 문의
          </button>
        </div>
        <div className="px-5 flex-1 flex flex-col">
        {/* 고객센터 문의 안내 - 문의 내역 탭에서만 표시 */}
        {activeTab === "inquiry" && (
          <div className="mt-5 mb-5 bg-[#0C0C0C] py-[10px] px-[20px]">
            <p className="text-[#D5D5D5] text-sm">
              고객센터 문의는 ppadun923@gmail.com 입니다.
            </p>
          </div>
        )}

        {/* 답변 받은 문의 탭에서는 상단 여백 */}
        {activeTab === "answered" && <div className="mt-5" />}

        {/* 문의 목록 */}
        {isLoading ? (
          // 로딩 스켈레톤
          <div className="flex flex-col gap-4 flex-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-full h-[106px] bg-[#1A1A1A] rounded-[10px] animate-pulse"
              />
            ))}
          </div>
        ) : inquiries.length > 0 ? (
          // 문의 리스트
          <div className="flex flex-col gap-4 flex-1">
            {inquiries.map((inquiry) => (
              <button
                key={inquiry.id}
                onClick={() => setLocation(`/inquiry/${inquiry.id}`)}
                className="relative w-full bg-[#1C1F20] rounded-[10px] p-5 overflow-hidden text-left hover-elevate active-elevate-2"
                data-testid={`inquiry-${inquiry.id}`}
              >
                {/* 배경 빛 효과 */}
                <div
                  className="absolute -left-[134px] -top-[183px] w-[223px] h-[223px] bg-[#E11936] opacity-50 blur-[50px] pointer-events-none z-0"
                  style={{ filter: "blur(50px)" }}
                />

                {/* 컨텐츠 */}
                <div className="relative z-10 flex flex-col gap-[14px]">
                  {/* 제목 */}
                  <h3
                    className="text-[#E9E9E9] text-base font-semibold leading-[140%] tracking-[-0.025em] truncate"
                    data-testid={`inquiry-title-${inquiry.id}`}
                  >
                    {inquiry.title}
                  </h3>

                  {/* 하단 정보 */}
                  <div className="flex justify-between items-center gap-2">
                    {/* 왼쪽: 카테고리 + 날짜 */}
                    <div className="flex items-center gap-2 text-[#BFBFBF] text-[13px] leading-[140%] tracking-[-0.025em] min-w-0 truncate">
                      <span data-testid={`inquiry-category-${inquiry.id}`}>
                        {inquiry.category}
                      </span>
                      <span>·</span>
                      <span data-testid={`inquiry-date-${inquiry.id}`}>
                        {format(
                          new Date(inquiry.createdAt),
                          "yyyy.MM.dd HH:mm",
                        )}
                      </span>
                    </div>

                    {/* 오른쪽: 상태 버튼 */}
                    <div className="flex justify-center items-center px-[10px] py-[5px] bg-[#111111] rounded-[50px]">
                      <span
                        className="text-[#959595] text-sm font-medium leading-[140%] tracking-[-0.025em] whitespace-nowrap"
                        data-testid={`inquiry-status-${inquiry.id}`}
                      >
                        {getStatusText(inquiry.status)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          // 빈 상태
          <div className="flex-1 flex flex-col items-center justify-center pb-20">
            <img
              src={assets.noCommentImg}
              alt={activeTab === "inquiry" ? "문의 내역 없음" : "답변 받은 문의 없음"}
              className="w-[150px] h-[150px] mb-6 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              data-testid="img-empty-inquiry"
            />
            <p className="text-[#6B6B6B] text-sm">
              {activeTab === "inquiry"
                ? "문의 내역이 존재하지 않습니다."
                : "답변 받은 문의가 존재하지 않습니다."}
            </p>
          </div>
        )}

        {/* 문의하기 버튼 */}
        {activeTab === "inquiry" && (
          <div className="pb-14 w-auto flex justify-end">
            <button
              onClick={() => { if (!checkGuest()) setLocation("/inquiry/create"); }}
              className="w-auto bg-[#CDFF00] text-black text-base font-semibold rounded-[48px] hover:bg-[#B8E600] transition-colors flex items-center justify-center gap-2 py-[10px] pr-[20px] pl-4"
              data-testid="button-inquiry"
            >
              <img src={assets.penIcon} alt="pen icon" />
              문의하기
            </button>
          </div>
        )}
        </div>
      </div>
      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />
      <BottomNavigation />
    </div>
  );
}
