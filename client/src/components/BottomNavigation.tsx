import { useState } from "react";
import { useLocation } from "wouter";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useUser } from "@/contexts/UserContext";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";

export default function BottomNavigation() {
  const [location, setLocation] = useLocation();
  const { assets } = useUserAssets();
  const { logout } = useUser();
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  const handleLogout = async () => {
    const result = await logout();
    if (!result.nativeHandled) {
      setLocation("/login");
    }
  };

  const navItems = [
    {
      id: "invite",
      label: "초대",
      path: "/invitation",
      icon: assets.inviteNavIcon,
      activeIcon: assets.inviteNavActiveIcon,
    },
    {
      id: "attendance",
      label: "출석",
      path: "/attendance",
      icon: assets.attendanceIcon,
      activeIcon: assets.attendanceActiveIcon,
    },
    {
      id: "board",
      label: "게시",
      path: "/board",
      icon: assets.boardIcon,
      activeIcon: assets.boardActiveIcon,
    },
    {
      id: "point",
      label: "추가",
      path: "/point",
      icon: assets.pointIcon,
      activeIcon: assets.pointActiveIcon,
    },
  ];

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-[#111111] border-t border-[#373539] z-[65]">
        {/* 네비게이션 버튼 영역 */}
        <div className="flex items-center justify-around px-4 pt-4 pb-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 ${
                location === item.path ? "text-[#CDFF00]" : "text-[#6B6B6B]"
              }`}
            >
              <div className="relative w-6 h-6">
                <img
                  src={item.icon}
                  alt={`${item.label} 아이콘`}
                  className={`absolute inset-0 w-6 h-6 transition-opacity duration-200 ${
                    location === item.path ? "opacity-0" : "opacity-100"
                  }`}
                />
                <img
                  src={item.activeIcon}
                  alt={`${item.label} 활성 아이콘`}
                  className={`absolute inset-0 w-6 h-6 transition-opacity duration-200 ${
                    location === item.path ? "opacity-100" : "opacity-0"
                  }`}
                />
              </div>
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
          <button
            data-testid="nav-logout"
            onClick={() => setShowLogoutPopup(true)}
            className="flex flex-col items-center justify-center gap-1 flex-1 text-[#6B6B6B]"
          >
            <div className="relative w-6 h-6">
              <img
                src={assets.logoutIcon}
                alt="로그아웃 아이콘"
                className="absolute inset-0 w-6 h-6"
              />
            </div>
            <span className="text-xs">로그아웃</span>
          </button>
        </div>
        {/* Safe area 하단 여백 - 홈 인디케이터 영역 */}
        <div className="pb-safe-bottom" />
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
