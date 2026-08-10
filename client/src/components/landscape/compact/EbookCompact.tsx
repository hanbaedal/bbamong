import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { navigateEmbed } from "@/lib/gameEmbed";
import type { Ebook, EbookPurchase } from "@shared/schema";
import { useUserAssets } from "@/contexts/UserAssetContext";

interface DonatedPointsData {
  totalDonated: number;
  totalSpent: number;
  availableDonatedPoints: number;
}

/** 게임 split 우측 — 나의 콘텐츠(전자책) 밀도·스크롤 최적화 */
export default function EbookCompact() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"available" | "owned">("available");
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedEbook, setSelectedEbook] = useState<Ebook | null>(null);
  const { assets } = useUserAssets();

  const { data: donatedPointsData, isLoading: isLoadingDonatedPoints } = useQuery<DonatedPointsData>({
    queryKey: [`/api/users/${user?.id}/donated-points`],
    enabled: !!user?.id,
    refetchOnMount: "always",
  });

  const { data: ebooks = [], isLoading: isLoadingEbooks } = useQuery<Ebook[]>({
    queryKey: ["/api/ebooks"],
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (user?.id) {
      queryClient.invalidateQueries({
        queryKey: [`/api/ebook-purchases/user/${user.id}`],
      });
    }
  }, [user?.id]);

  const { data: purchases = [], isLoading: isLoadingPurchases } = useQuery<
    Array<EbookPurchase & { ebook: Ebook }>
  >({
    queryKey: [`/api/ebook-purchases/user/${user?.id}`],
    enabled: !!user?.id,
    refetchOnMount: "always",
  });

  const purchaseMutation = useMutation({
    mutationFn: async (ebookId: number) => {
      const response = await apiRequest("POST", "/api/ebook-purchases", {
        userId: user?.id,
        ebookId,
      });
      let data: { error?: string };
      try {
        data = await response.json();
      } catch {
        if (!response.ok) throw new Error("전자책 교환에 실패했습니다.");
        return {};
      }
      if (!response.ok) throw new Error(data.error || "전자책 교환에 실패했습니다.");
      return data;
    },
    onSuccess: async () => {
      toast({
        title: "교환 완료",
        description: "전자책이 성공적으로 교환되었습니다.",
      });
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
    onError: () => {
      setShowConfirm(false);
      setSelectedEbook(null);
    },
  });

  const handlePurchaseClick = (ebook: Ebook) => {
    setSelectedEbook(ebook);
    setShowConfirm(true);
  };

  const handleConfirmPurchase = () => {
    if (selectedEbook) purchaseMutation.mutate(selectedEbook.id);
  };

  const handleCancelPurchase = () => {
    setShowConfirm(false);
    setSelectedEbook(null);
  };

  const handleConfirmOpen = () => {
    setShowConfirm(false);
    setSelectedEbook(null);
    navigateEmbed("/customer-center", setLocation);
  };

  const displayedEbooks =
    activeTab === "available" ? ebooks : purchases.map((p) => p.ebook);

  return (
    <div className="ebook-compact" data-testid="page-ebook-compact">
      <div className="ebook-compact__balance" data-testid="selected-match">
        <span className="ebook-compact__balance-label">사용 가능한 참여 기록</span>
        <span className="ebook-compact__balance-value">
          {isLoadingDonatedPoints
            ? "..."
            : (donatedPointsData?.availableDonatedPoints?.toLocaleString() || 0)}
        </span>
      </div>

      <div className="ebook-compact__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "available"}
          data-testid="tab-available"
          onClick={() => setActiveTab("available")}
          className={`ebook-compact__tab ${activeTab === "available" ? "ebook-compact__tab--on" : ""}`}
        >
          나의 콘텐츠
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "owned"}
          data-testid="tab-owned"
          onClick={() => setActiveTab("owned")}
          className={`ebook-compact__tab ${activeTab === "owned" ? "ebook-compact__tab--on" : ""}`}
        >
          보유 중
        </button>
      </div>

      <div className="ebook-compact__list">
        {isLoadingEbooks || isLoadingPurchases ? (
          <p className="ebook-compact__empty">로딩 중...</p>
        ) : displayedEbooks.length === 0 ? (
          <div className="ebook-compact__empty-wrap">
            <img
              src={assets.noCommentImg}
              className="ebook-compact__empty-img"
              alt=""
            />
            <p className="ebook-compact__empty">
              {activeTab === "available"
                ? "교환 가능한 전자책이 없습니다."
                : "보유중인 나의 콘텐츠가 없습니다"}
            </p>
          </div>
        ) : (
          displayedEbooks.map((ebook) => (
            <div key={ebook.id} className="ebook-compact__row" data-testid={`ebook-item-${ebook.id}`}>
              <span className="ebook-compact__name">{ebook.name}</span>
              {activeTab === "available" ? (
                <button
                  type="button"
                  data-testid={`button-purchase-${ebook.id}`}
                  onClick={() => handlePurchaseClick(ebook)}
                  className="ebook-compact__action"
                >
                  열람하기
                </button>
              ) : (
                <button
                  type="button"
                  data-testid={`button-open-${ebook.id}`}
                  onClick={() => {
                    setSelectedEbook(ebook);
                    setShowConfirm(true);
                  }}
                  className="ebook-compact__action"
                >
                  열기
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {showConfirm && selectedEbook ? (
        <>
          <div className="ebook-compact__backdrop" />
          <div className="ebook-compact__dialog" role="dialog" aria-modal="true">
            <p className="ebook-compact__dialog-text">
              {activeTab === "available"
                ? `참여 기록으로 전자책을 교환하시겠어요?\n누적 참여 기록에서 ${selectedEbook.price.toLocaleString()}가 차감됩니다.`
                : `전자책 교환 문의는 PPAMONG 고객센터로 이동합니다.\n이동하시겠습니까?`}
            </p>
            <div className="ebook-compact__dialog-actions">
              <button
                type="button"
                data-testid="button-confirm-left"
                className="ebook-compact__dialog-btn ebook-compact__dialog-btn--ghost"
                onClick={handleCancelPurchase}
              >
                뒤로가기
              </button>
              <button
                type="button"
                data-testid="button-confirm-right"
                className="ebook-compact__dialog-btn ebook-compact__dialog-btn--primary"
                onClick={activeTab === "available" ? handleConfirmPurchase : handleConfirmOpen}
              >
                {activeTab === "available" ? "교환하기" : "이동하기"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
