import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Ebook, EbookPurchase, User } from "@shared/schema";
import { useUserAssets } from "@/contexts/UserAssetContext";

interface DonatedPointsData {
  totalDonated: number;
  totalSpent: number;
  availableDonatedPoints: number;
}

export default function EbookPage() {
  const { user, setUser } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"available" | "owned">(
    "available",
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedEbook, setSelectedEbook] = useState<Ebook | null>(null);

  const { assets } = useUserAssets();

  // 사용자의 기부 포인트 조회
  const { data: donatedPointsData, isLoading: isLoadingDonatedPoints } = useQuery<DonatedPointsData>({
    queryKey: [`/api/users/${user?.id}/donated-points`],
    enabled: !!user?.id,
    refetchOnMount: "always",
  });

  // 모든 전자책 조회
  const { data: ebooks = [], isLoading: isLoadingEbooks } = useQuery<Ebook[]>({
    queryKey: ["/api/ebooks"],
    refetchOnMount: "always",
  });

  useEffect(() => {
    // 사용자 ID 변경 시 쿼리 무효화
    if (user?.id) {
      queryClient.invalidateQueries({
        queryKey: [`/api/ebook-purchases/user/${user.id}`],
      });
    }
  }, [user?.id]);

  // 사용자의 구매내역 조회
  const { data: purchases = [], isLoading: isLoadingPurchases } = useQuery<
    Array<EbookPurchase & { ebook: Ebook }>
  >({
    queryKey: [`/api/ebook-purchases/user/${user?.id}`],
    enabled: !!user?.id,
    refetchOnMount: "always",
  });

  // 전자책 구매 mutation
  const purchaseMutation = useMutation({
    mutationFn: async (ebookId: number) => {
      const response = await apiRequest("POST", "/api/ebook-purchases", {
        userId: user?.id,
        ebookId,
      });
      let data;
      try {
        data = await response.json();
      } catch {
        if (!response.ok) {
          throw new Error("전자책 교환에 실패했습니다.");
        }
        return {};
      }
      if (!response.ok) {
        throw new Error(data.error || "전자책 교환에 실패했습니다.");
      }
      return data;
    },
    onSuccess: async () => {
      toast({
        title: "교환 완료",
        description: "전자책이 성공적으로 교환되었습니다.",
      });

      // 기부 포인트 데이터 새로고침
      queryClient.invalidateQueries({
        queryKey: [`/api/ebook-purchases/user/${user?.id}`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ebooks"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/users/${user?.id}/donated-points`],
      });
      setShowConfirm(false);
      setSelectedEbook(null);
    },
    onError: (error: any) => {
      setShowConfirm(false);
      setSelectedEbook(null);
    },
  });

  const handlePurchaseClick = (ebook: Ebook) => {
    setSelectedEbook(ebook);
    setShowConfirm(true);
  };

  const handleConfirmPurchase = () => {
    if (selectedEbook) {
      purchaseMutation.mutate(selectedEbook.id);
    }
  };

  const handleCancelPurchase = () => {
    setShowConfirm(false);
    setSelectedEbook(null);
  };

  const handleConfirmOpen = () => {
    setShowConfirm(false);
    setSelectedEbook(null);
    setLocation("/customer-center");
  };
  // 구매한 전자책 ID 목록
  const purchasedEbookIds = purchases.map((p) => p.ebookId);

  // 탭에 따른 전자책 목록 필터링
  const displayedEbooks =
    activeTab === "available"
      ? ebooks
      : purchases.map((p) => p.ebook);

  return (
    <div className="h-app-screen bg-[#111111]">
      {/* 헤더 */}
      <PageHeader />

      {/* 컨텐츠 영역 */}
      <div className="flex-1 flex flex-col gap-6 pt-[10px] overflow-y-scroll-touch pb-bottom-nav">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">나의 콘텐츠 : 에세이 / 시 / 시조</h1>

        {/* 기부 포인트 박스 */}
        <div className="px-5">
          <div
            data-testid="selected-match"
            className="relative rounded-lg px-4 bg-[#1C1F20]"
          >
            <div
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{
                padding: "1px",
                backgroundImage: "linear-gradient(to right, #CDFF00, #97862A)",
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "destination-out",
                maskComposite: "exclude",
              }}
            ></div>

            <div className="relative flex items-center justify-between px-4 py-3 rounded-xl h-[65px] overflow-hidden">
              <span className="text-[#D5D5D5] text-sm font-medium">
                사용 가능한 참여 기록
              </span>
              <span className="text-white text-2xl font-bold tracking-tight">
                {isLoadingDonatedPoints 
                  ? "..." 
                  : (donatedPointsData?.availableDonatedPoints?.toLocaleString() || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-4 mx-5">
          <button
            data-testid="tab-available"
            onClick={() => setActiveTab("available")}
            className={`pb-3 text-sm font-medium transition-colors w-full ${
              activeTab === "available"
                ? "text-white border-b-2 border-[#CCF501]"
                : "text-[#9E9E9E]"
            }`}
          >
            나의 콘텐츠
          </button>
          <button
            data-testid="tab-owned"
            onClick={() => setActiveTab("owned")}
            className={`pb-3 text-sm font-medium transition-colors w-full ${
              activeTab === "owned"
                ? "text-white border-b-2 border-[#CCF501]"
                : "text-[#9E9E9E]"
            }`}
          >
            보유 중
          </button>
        </div>

        {/* 전자책 목록 */}
        <div className="px-5">
        {isLoadingEbooks || isLoadingPurchases ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-[#9E9E9E]">로딩 중...</div>
          </div>
        ) : displayedEbooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-auto">
            <img
              src={assets.noCommentImg}
              className="w-[150px] h-[150px] mb-4 object-contain"
            />
            <div className="text-[#9E9E9E] text-sm">
              {activeTab === "available"
                ? "교환 가능한 전자책이 없습니다."
                : "보유중인 나의 콘텐츠가 없습니다"}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayedEbooks.map((ebook) => (
              <div
                key={ebook.id}
                data-testid={`ebook-item-${ebook.id}`}
                className="py-4 flex items-center justify-between"
              >
                <div className="flex gap-[10px] items-center">
                  <span className="text-white text-sm font-medium break-words whitespace-wrap max-w-[100px]">
                    {ebook.name}
                  </span>
                </div>

                {activeTab === "available" ? (
                  <button
                    data-testid={`button-purchase-${ebook.id}`}
                    onClick={() => handlePurchaseClick(ebook)}
                    className="px-[10px] py-[5px] bg-[#1C1F20] text-white whitespace-nowrap text-sm font-medium rounded-sm hover:bg-[#2F2F2F] disabled:opacity-50"
                  >
                    열람하기
                  </button>
                ) : (
                  <button
                    data-testid={`button-open-${ebook.id}`}
                    onClick={() => {
                      setSelectedEbook(ebook);
                      setShowConfirm(true);
                    }}
                    className="px-[10px] py-[5px] bg-[#1C1F20] text-white text-sm font-medium rounded-sm "
                  >
                    열기
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {showConfirm && selectedEbook && (
        <>
          <div className="fixed inset-0 bg-[#000000CC] z-[70]" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[320px] bg-[#2F2F2F] shadow-[0_8px_36px_rgba(0,0,0,0.16)] rounded-[8px] flex flex-col items-center p-[20px_20px_16px] gap-2 z-[75]">
            <div className="flex flex-col justify-center items-center gap-[10px] px-2">
              <p className="text-center text-[#E9E9E9] font-[Pretendard] font-normal text-[16px] leading-[140%] tracking-[-0.025em] whitespace-pre-line">
                {activeTab === "available"
                  ? `참여 기록으로 전자책을 교환하시겠어요?\n누적 참여 기록에서 ${selectedEbook.price.toLocaleString()}가 차감됩니다.`
                  : `전자책 교환 문의는 PPAMONG 고객센터로 이동합니다.\n이동하시겠습니까?`}
              </p>
            </div>
            <div className="w-full flex flex-row justify-center items-center gap-2 px-2">
              <button
                data-testid="button-confirm-left"
                className="flex-1 h-[40px] bg-[#474747] rounded-[6px] flex justify-center items-center p-[10px] gap-[10px] font-[Pretendard] font-semibold text-[14px] leading-[140%] text-[#E9E9E9]"
                onClick={handleCancelPurchase}
              >
                뒤로가기
              </button>
              <button
                data-testid="button-confirm-right"
                className="flex-1 h-[40px] bg-[#CCF501] active:bg-[#C8D48D] border border-[#CDFF00] rounded-[6px] flex justify-center items-center p-[10px] gap-[10px] font-[Pretendard] font-semibold text-[14px] leading-[140%] text-[#111111]"
                onClick={activeTab === "available" ? handleConfirmPurchase : handleConfirmOpen}
              >
                {activeTab === "available" ? "교환하기" : "이동하기"}
              </button>
            </div>
          </div>
        </>
      )}
      <BottomNavigation />
    </div>
  );
}
