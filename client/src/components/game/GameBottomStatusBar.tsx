import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";
import { formatKstDisplayDate } from "@/lib/kstDate";

function greetingName(isGuest: boolean, name?: string | null): string {
  if (isGuest) return "게스트";
  const trimmed = name?.trim();
  return trimmed || "회원";
}

export default function GameBottomStatusBar() {
  const [, setLocation] = useLocation();
  const { user, isGuest, logout } = useUser();
  const { assets } = useUserAssets();
  const [dateText, setDateText] = useState(() => formatKstDisplayDate());
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  useEffect(() => {
    setDateText(formatKstDisplayDate());
    const id = setInterval(() => setDateText(formatKstDisplayDate()), 60_000);
    return () => clearInterval(id);
  }, []);

  const displayName = greetingName(isGuest, user?.name);

  const handleLogout = async () => {
    const result = await logout();
    if (!result.nativeHandled) {
      setLocation("/login");
    }
  };

  return (
    <>
      <div
        className="absolute bottom-1.5 sm:bottom-2 left-0 right-0 z-20 flex items-end justify-between px-2 sm:px-3"
        data-testid="game-bottom-status-bar"
      >
        <p
          className="text-[10px] sm:text-xs text-white font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] pointer-events-none"
          data-testid="game-bottom-date"
        >
          {dateText}
        </p>

        <div className="flex items-center">
          <p
            className="text-[10px] sm:text-xs text-white font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
            data-testid="game-bottom-greeting"
          >
            안녕하세요. {displayName}님
          </p>
          <span className="inline-block w-[3ch]" aria-hidden />
          <button
            type="button"
            onClick={() => setShowLogoutPopup(true)}
            className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 opacity-90 hover:opacity-100 transition-opacity"
            aria-label="로그아웃"
            data-testid="game-bottom-logout"
          >
            <img
              src={assets.logoutIcon}
              alt=""
              className="w-full h-full object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
            />
          </button>
        </div>
      </div>

      {showLogoutPopup && (
        <SimpleConfirmPopup
          message="로그아웃 하시겠어요?"
          leftButtonText="취소"
          rightButtonText="로그아웃"
          onLeftClick={() => setShowLogoutPopup(false)}
          onRightClick={async () => {
            setShowLogoutPopup(false);
            await handleLogout();
          }}
        />
      )}
    </>
  );
}
