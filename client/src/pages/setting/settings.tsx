import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";
import { useUser } from "@/contexts/UserContext";
import { clearTokens } from "@/lib/tokenManager";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";


export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { assets } = useUserAssets();
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const { user, setUser, isGuest } = useUser();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      // 인증된 사용자만 본인 계정 삭제 가능
      return await apiRequest("DELETE", `/api/users/me`);
    },
    onSuccess: async () => {
      await clearTokens();
      queryClient.clear();
      setUser(null);
      await new Promise(resolve => setTimeout(resolve, 0));
      setLocation("/login");
    },
    onError: (error: Error) => {
      console.error("회원 탈퇴 실패:", error);
    },
  });

  const menuItems = [
    {
      id: "profile",
      label: "회원정보",
      icon: assets.userInfoIcon,
      hasArrow: true,
      onClick: () => {
        if (checkGuest()) return;
        if (user?.provider && user.provider !== 'local' && !user.hasPassword) {
          sessionStorage.setItem("profileVerified", Date.now().toString());
          setLocation("/profile");
        } else {
          setLocation("/verify-identity");
        }
      },
    },
    {
      id: "customer-center",
      label: "고객센터",
      icon: assets.customerServiceIcon,
      hasArrow: true,
      onClick: () => { if (!checkGuest()) setLocation("/customer-center"); },
    },
    {
      id: "notice",
      label: "공지사항",
      icon: assets.informationIcon,
      hasArrow: true,
      onClick: () => setLocation("/notice"),
    },
    {
      id: "victory-verification",
      label: "승리현황",
      icon: assets.historyIcon,
      hasArrow: true,
      onClick: () => setLocation("/victory-history"),
    },
    {
      id: "ebook-service",
      label: "나의 콘텐츠 : 에세이 / 시 / 시조",
      icon: assets.ebookServiceIcon,
      hasArrow: true,
      onClick: () => setLocation("/ebook"),
    },
    {
      id: "donation",
      label: "사회공헌참여현황",
      icon: assets.historyIcon,
      hasArrow: true,
      onClick: () => setLocation("/donation-history"),
    },
    {
      id: "terms",
      label: "서비스 이용약관",
      icon: assets.termInfoIcon,
      hasExternalLink: true,
      onClick: () => setLocation("/terms"),
    },
    {
      id: "qna",
      label: "Q&A",
      icon: assets.qnaIcon,
      hasExternalLink: true,
      onClick: () => setLocation("/faq"),
    },
  ];

  return (
    <div className="h-app-screen bg-[#111111]">
      {/* 헤더 */}
      <PageHeader
        leftAction={
          <button
            data-testid="button-back"
            onClick={() => setLocation("/home")}
            className="p-1"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
      />

      {/* 메뉴 리스트 */}
      <div className="flex-1 flex flex-col px-5 pt-[10px] gap-[26px] overflow-y-scroll-touch pb-bottom-nav">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">설정</h1>
        {/* 첫 번째 그룹 (회원정보 ~ 거버넌스) */}
        <div className="flex flex-col gap-[10px]">
          {menuItems.slice(0, 2).map((item) => (
            <button
              key={item.id}
              data-testid={`button-${item.id}`}
              onClick={item.onClick}
              className="flex items-center justify-between py-[14px] border-b border-[#373539] hover-elevate active-elevate-2"
            >
              <div className="flex items-center gap-[10px]">
                <img
                  src={item.icon}
                  alt=""
                  className="w-6 h-6"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="text-[#D5D5D5] text-base">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#D5D5D5]" />
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-[10px]">
          {menuItems.slice(2, 6).map((item) => (
            <button
              key={item.id}
              data-testid={`button-${item.id}`}
              onClick={item.onClick}
              className="flex items-center justify-between py-[14px] border-b border-[#373539] hover-elevate active-elevate-2"
            >
              <div className="flex items-center gap-[10px]">
                <img
                  src={item.icon}
                  alt=""
                  className="w-6 h-6"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="text-[#D5D5D5] text-base">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#D5D5D5]" />
            </button>
          ))}
        </div>

        {/* 두 번째 그룹 (서비스 이용약관, Q&A) */}
        <div className="flex flex-col gap-[10px]">
          {menuItems.slice(6, 8).map((item) => (
            <button
              key={item.id}
              data-testid={`button-${item.id}`}
              onClick={item.onClick}
              className="flex items-center justify-between py-[14px] border-b border-[#373539] hover-elevate active-elevate-2"
            >
              <div className="flex items-center gap-[10px]">
                <img
                  src={item.icon}
                  alt=""
                  className="w-6 h-6"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="text-[#D5D5D5] text-base">{item.label}</span>
              </div>
              <img
                src={assets.linkIcon}
                alt=""
                className="w-5 h-5"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </button>
          ))}
        </div>

        {/* 세 번째 그룹 (탈퇴하기) */}
        <div className="flex flex-col gap-[10px]">
          <button
            data-testid="button-delete-account"
            onClick={() => setShowDeletePopup(true)}
            className="flex items-center justify-between py-[14px] border-b border-[#373539] hover-elevate active-elevate-2"
          >
            <div className="flex gap-[10px]">
              <img
                src={assets.withdrawIcon}
                alt=""
                className="w-6 h-6"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="text-[#E11937] text-base">탈퇴하기</span>
            </div>
            <ChevronRight className="w-5 h-5 text-[#E11937]" />
          </button>
        </div>
      </div>

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />

      {showDeletePopup && (
        <SimpleConfirmPopup
          message="계정을 영구적으로 탈퇴하시겠어요?"
          leftButtonText="취소하기"
          rightButtonText="탈퇴하기"
          onLeftClick={() => setShowDeletePopup(false)}
          onRightClick={() => {
            deleteAccountMutation.mutate();
            setShowDeletePopup(false);
          }}
        />
      )}
      <BottomNavigation />
    </div>
  );
}
