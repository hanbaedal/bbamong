import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";

export default function DonationHistoryPage() {
  const { user } = useUser();
  const { assets } = useUserAssets();
  const { data, isLoading } = useQuery<{
    success: boolean;
    totalAmount: number;
    donations: {
      id: number;
      amount: number;
      description?: string;
      createdAt: string;
      balance: number;
    }[];
  }>({
    queryKey: ["/api/donations/user", user?.id],
    enabled: !!user?.id,
    refetchOnMount: "always",
  });

  const { data: rankData } = useQuery<{
    success: boolean;
    rank: number;
    totalAmount: number;
  }>({
    queryKey: ["/api/donations/user", user?.id, "rank"],
    enabled: !!user?.id,
    refetchOnMount: "always",
  });

  const donations = data?.donations || [];
  const totalAmount = data?.totalAmount || 0;
  const rank = rankData?.rank || 0;

  return (
    <div className="h-app-screen bg-[#111111] w-full">
      {/* 헤더 */}
      <PageHeader />

      {/* 컨텐츠 영역 */}
      <div className="flex-1 flex flex-col gap-6 pt-[10px] overflow-y-scroll-touch pb-bottom-nav">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">사회공헌참여현황</h1>
        {/* 가부 행정 1위 박스 */}
        <div className="px-5">
          <div className="relative bg-[#1C1F20] rounded-xl p-4">
            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="text-[#BFBFBF] text-base">사회공헌참여현황</span>
              <span className="text-white text-lg font-semibold">
                {totalAmount.toLocaleString()}
              </span>
              {/* 아이콘 placeholder */}
              {/* <div className="w-5 h-5 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 2L12.5 7.5L18 8.5L14 12.5L15 18L10 15.5L5 18L6 12.5L2 8.5L7.5 7.5L10 2Z"
                    fill="#E9E9E9"
                  />
                </svg>
              </div>
              <span className="text-[#FDE047] text-xl font-bold">
                {rank > 0 ? `기부 랭킹 ${rank}위` : "기부 랭킹 -위"}
              </span> */}
            </div>

            <div
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{
                padding: "1px", // border 두께
                backgroundImage: "linear-gradient(to right, #CDFF00, #97862A)",
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "destination-out",
                maskComposite: "exclude",
              }}
            >
            </div>
          </div>
        </div>

        {/* 기부 내역 */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[#9E9E9E]">로딩 중...</div>
          </div>
        ) : donations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
            {/* 빈 이미지 placeholder */}
            <div className="w-[40%] aspect-square flex items-center justify-center">
              <div className="w-full h-full rounded-lg flex items-center justify-center">
                <img
                  src={assets.noCommentImg}
                  className="w-full h-full object-contain"
                ></img>
              </div>
            </div>
            <p className="text-[#9E9E9E] text-base">
              기부 내역이 존재하지 않습니다.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col px-5 py-5 border-t-8 border-[#1C1F20]">
            {/* 총 기부 포인트 */}
            <div className="text-center mb-4 gap-2 flex justify-center">
              <span className="text-[#9E9E9E] text-base">
                누적 사회공헌기록 : 
              </span>
              <span className="text-[#FF5757] text-base font-semibold">
                 {totalAmount.toLocaleString()}
              </span>
            </div>

            {/* 기부 내역 리스트 */}
            <div className="flex-1 overflow-y-scroll-touch space-y-0">
              {donations.map((donation, index) => (
                <div
                  key={donation.id}
                  data-testid={`donation-item-${donation.id}`}
                >
                  <div className="flex flex-col py-3 w-full">
                    <span className="text-[#AAAAAA] text-sm">
                      {(() => {
                        const date = new Date(donation.createdAt);
                        const month = String(date.getMonth() + 1).padStart(
                          2,
                          "0",
                        );
                        const day = String(date.getDate()).padStart(2, "0");
                        const hours = String(date.getHours()).padStart(2, "0");
                        const minutes = String(date.getMinutes()).padStart(
                          2,
                          "0",
                        );
                        return `${month}.${day} · ${hours}:${minutes}`;
                      })()}
                    </span>
                    {/* 왼쪽: 날짜 + "기부" */}
                    <div className="flex  gap-1 flex-1 justify-between">
                      <span className="text-white text-base">공헌</span>
                      <span className="text-[#FDE047] text-base font-semibold">
                        {donation.amount.toLocaleString()}
                      </span>
                    </div>

                    {/* 오른쪽: 포인트 */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[#AAAAAA] text-sm">
                        보유 {donation.balance.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* 구분선 (마지막 아이템 제외) */}
                  {index < donations.length - 1 && (
                    <div className="h-px bg-[#2A2A2A]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <BottomNavigation />
    </div>
  );
}
