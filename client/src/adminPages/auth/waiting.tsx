import { useLocation } from "wouter";
import { useAdminAssets } from "@/contexts/AdminAssetContext";

export default function AdminWaitingPage() {
  const [, setLocation] = useLocation();
  const { assets } = useAdminAssets();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-[343px] flex flex-col items-center gap-[40px]">
        {/* 로고 */}
        <div
          className="w-[149px] h-[110px] flex items-center justify-center"
          data-testid="admin-waiting-logo-container"
        >
          <img
            src={assets.loginLogo}
            alt="관리자 로고"
            className="w-full h-full object-contain"
            data-testid="img-admin-waiting-logo"
          />
        </div>

        {/* 손 아이콘 */}
        <div
          className="w-50 h-50 flex items-center justify-center"
          data-testid="admin-waiting-icon-container"
        >
          <img
            src={assets.adPermissionPendingIcon}
            className="w-full h-full object-contain"
            alt="승인 대기"
          />
        </div>

        {/* 안내 문구 */}
        <div className="flex flex-col items-center gap-2">
          <h1
            className="text-[#201E22] text-[18px] font-semibold leading-[140%] tracking-[-0.025em] text-center"
            data-testid="text-waiting-message"
          >
            관리자 승인을 기다리고 있습니다.
          </h1>
        </div>

        <div
          className="flex flex-col items-center gap-2 cursor-pointer"
          onClick={() => setLocation("/admin/login")}
        >
          <h1
            className="text-[#E11936] text-[15px] font-semibold leading-[140%] tracking-[-0.025em] text-center"
            data-testid="button-go-to-login"
          >
            로그인 페이지로 이동
          </h1>
        </div>
      </div>
    </div>
  );
}
