import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { Button } from "@/components/ui/button";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useQuery } from "@tanstack/react-query";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";

interface InviteInfo {
  inviteCode: string;
  invitedCount: number;
}

export default function InvitePage() {
  const [, setLocation] = useLocation();
  const { assets } = useUserAssets();
  const { toast } = useToast();
  const { isGuest } = useUser();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);

  // 초대 정보 조회
  const { data: inviteInfo, isLoading } = useQuery<InviteInfo>({
    queryKey: ["/api/users/invite-info"],
    refetchOnMount: "always",
  });

  const inviteCode = inviteInfo?.inviteCode || "로딩중...";
  const invitedCount = inviteInfo?.invitedCount || 0;

  const handleShareInvite = async () => {
    if (checkGuest()) return;
    const shareText = `야구 게임에 초대합니다!\n\n초대 코드: ${inviteCode}\n\n지금 바로 참여하세요!`;

    // 네이티브 앱인 경우 Capacitor Share 사용
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: "친구 초대",
          text: shareText,
          dialogTitle: "친구에게 공유하기",
        });
      } catch (error) {
        // 사용자가 공유를 취소한 경우는 무시
        if ((error as Error).message !== "Share canceled") {
          console.error("공유 실패:", error);
          fallbackCopyCode();
        }
      }
    } else if (navigator.share) {
      // 웹에서 Web Share API 지원하는 경우
      try {
        await navigator.share({
          title: "친구 초대",
          text: shareText,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          fallbackCopyCode();
        }
      }
    } else {
      // 그 외 클립보드 복사
      fallbackCopyCode();
    }
  };

  const fallbackCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast({
      title: "복사 완료",
      description: "초대 코드가 클립보드에 복사되었습니다.",
    });
  };


  if (isLoading) {
    return (
      <div className="h-app-screen bg-[#111111] flex items-center justify-center">
        <p className="text-white">로딩중...</p>
      </div>
    );
  }

  return (
    <div className="h-app-screen bg-[#111111]">
      {/* 헤더 */}
      <PageHeader
        leftAction={
          <button
            data-testid="button-back"
            onClick={() => setLocation("/home")}
            className="p-1 focus:outline-none"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
      />

      {/* 메인 콘텐츠 */}
      <main className="flex-1 px-5 pt-[10px] bg-[#111111] overflow-y-scroll-touch pb-bottom-nav">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">초대하기</h1>
        {/* 나의 초대 코드 */}
        <div className="flex flex-col items-center gap-3.5 mb-12">
          <p className="text-base font-medium text-[#BFBFBF]">나의 초대 코드</p>
          <p 
            className="text-[28px] font-bold text-[#CCF501] tracking-tight select-all"
            style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
          >
            {inviteCode}
          </p>
        </div>

        {/* 공유 버튼 */}
        <div className="mb-12">
          <Button
            variant="outline"
            className="w-full h-12 bg-[#1C1F20] border-[#1C1F20] text-white hover:bg-[#2A2D2E] flex items-center justify-center gap-2"
            onClick={handleShareInvite}
            data-testid="button-invite"
          >
            <img
              src={assets.phoneInviteIcon}
              className="w-5 h-5 object-contain"
            ></img>
            <span>초대하기</span>
          </Button>
        </div>

        {/* 친구 초대 현황 */}
        <div>
          <h2 className="text-base font-medium text-white mb-3.5">
            친구 초대 현황
          </h2>

          <div className="bg-[#1C1F20] rounded-xl border-2 border-[#CCF501] flex items-center h-[90px] justify-between overflow-hidden">
            <div className="flex flex-col justify-start shrink-0 h-full pl-4 pt-4">
              <span className="text-[13px] font-medium text-white whitespace-nowrap">
                누적 초대 수
              </span>
            </div>
            <div className="shrink-0 h-full flex items-center justify-center px-2">
              <img
                src={assets.invitationIcon}
                alt="야구공"
                className="w-[80px]"
              />
            </div>
            <div className="flex flex-col justify-end shrink-0 h-full pr-4 pb-4">
              <p className="text-2xl font-bold text-white text-end">
                {invitedCount}
                <span className="text-lg">명</span>
              </p>
            </div>
          </div>
        </div>
      </main>

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />
      <BottomNavigation />
    </div>
  );
}
