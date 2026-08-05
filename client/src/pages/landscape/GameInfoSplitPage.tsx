import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation } from "@tanstack/react-query";
import LandscapeMasterDetailShell from "@/components/landscape/LandscapeMasterDetailShell";
import LandscapeHubMenu from "@/components/landscape/LandscapeHubMenu";
import LandscapeGameContentPane from "@/components/landscape/LandscapeGameContentPane";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";
import { useUser } from "@/contexts/UserContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clearTokens } from "@/lib/tokenManager";
import {
  GAME_INFO_SECTIONS,
  GAME_INFO_WITHDRAW_ITEM,
  getGameInfoMenuActiveId,
  getGameInfoSection,
} from "@/lib/gameSplitConfig";

export default function GameInfoSplitPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/game/info/:section");
  const sectionId = params?.section;
  const section = getGameInfoSection(sectionId);
  const { setUser, isGuest } = useUser();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);
  const [showDeletePopup, setShowDeletePopup] = useState(false);

  const deleteAccountMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/users/me"),
    onSuccess: async () => {
      await clearTokens();
      queryClient.clear();
      setUser(null);
      await new Promise((resolve) => setTimeout(resolve, 0));
      setLocation("/login");
    },
    onError: (error: Error) => {
      console.error("회원 탈퇴 실패:", error);
    },
  });

  const menuItems = [
    ...GAME_INFO_SECTIONS.map((s) => ({
      id: s.id,
      label: s.label,
      testId: s.testId,
    })),
    GAME_INFO_WITHDRAW_ITEM,
  ];

  return (
    <>
      <LandscapeMasterDetailShell
        title="내 정보"
        theme="info"
        backTo="/prediction"
        testId="game-info-split"
        left={
          <LandscapeHubMenu
            theme="info"
            items={menuItems}
            activeId={getGameInfoMenuActiveId(section.id)}
            onSelect={(id) => setLocation(`/game/info/${id}`)}
            onDangerAction={() => {
              if (checkGuest()) return;
              setShowDeletePopup(true);
            }}
          />
        }
        right={<LandscapeGameContentPane theme="info" component={section.component} />}
      />

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />

      {showDeletePopup ? (
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
      ) : null}
    </>
  );
}
