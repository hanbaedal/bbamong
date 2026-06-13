import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import Lottie from "lottie-react";
import waitingAnimation from "../../../../attached_assets/Baseball_(1)_1767749776727.json";

export default function ManagerPendingApprovalPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="h-[100dvh] bg-white flex flex-col w-full overflow-hidden" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 44px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }}>
      {/* 헤더 */}
      <div className="h-[60px] flex items-center px-3 relative z-50">
        <button
          onClick={() => setLocation("/manager/login")}
          data-testid="button-back"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
        >
          <ArrowLeft className="w-6 h-6 text-black" />
        </button>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        {/* 손 아이콘 - Lottie 애니메이션 */}
        <div
          className="w-[120px] h-[120px] flex items-center justify-center mb-6"
          data-testid="manager-pending-icon-container"
        >
          <Lottie
            animationData={waitingAnimation}
            loop={true}
            className="w-full h-full"
          />
        </div>

        {/* 안내 문구 */}
        <p
          className="text-[#201E22] text-[16px] text-center"
          data-testid="text-pending-message"
        >
          관리자 승인을 기다리고 있습니다.
        </p>
      </div>

      {/* 로그인 페이지로 이동 버튼 */}
      <div className="pb-20 flex justify-center">
        <button
          onClick={() => setLocation("/manager/login")}
          data-testid="button-go-to-login"
          className="text-[#E11936] text-[15px] font-medium min-h-[44px] px-4"
        >
          로그인 페이지로 이동
        </button>
      </div>

      {/* 하단 인디케이터 */}
      <div className="h-[34px] bg-white flex items-center justify-center">
        <div className="w-[134px] h-[5px] bg-gray-200 rounded-full"></div>
      </div>
    </div>
  );
}
