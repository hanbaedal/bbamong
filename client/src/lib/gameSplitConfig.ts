import type { ComponentType } from "react";
import AttendancePage from "@/pages/attendance";
import DonationHistoryPage from "@/pages/setting/donation-history";
import EbookPage from "@/pages/setting/ebook";
import InvitePage from "@/pages/setting/invite";
import VictoryHistoryPage from "@/pages/setting/victory-history";
import FaqPage from "@/pages/setting/faq";
import PointPage from "@/pages/point";
import ProfilePage from "@/pages/setting/profile";
import TermsOfServicePage from "@/pages/setting/terms-of-service";
import VerifyIdentityPage from "@/pages/setting/verify-identity";
import type { HubMenuItem } from "@/components/landscape/LandscapeHubMenu";

export const GAME_STORY_BASE = "/game/story";
export const GAME_INFO_BASE = "/game/info";

export function gameStoryPath(sectionId: string): string {
  return `${GAME_STORY_BASE}/${sectionId}`;
}

export function gameInfoPath(sectionId: string): string {
  return `${GAME_INFO_BASE}/${sectionId}`;
}

export const GAME_STORY_SECTIONS: Array<{
  id: string;
  label: string;
  component: ComponentType;
  testId: string;
}> = [
  { id: "victory", label: "승리현황", component: VictoryHistoryPage, testId: "link-victory-history" },
  { id: "invite", label: "친구 초대", component: InvitePage, testId: "link-invite" },
  { id: "attendance", label: "출석 체크", component: AttendancePage, testId: "link-attendance" },
  { id: "ebook", label: "나의 콘텐츠", component: EbookPage, testId: "link-ebook" },
  { id: "donation", label: "사회공헌 참여현황", component: DonationHistoryPage, testId: "link-donation" },
];

export const GAME_INFO_SECTIONS: Array<{
  id: string;
  label: string;
  component: ComponentType;
  testId: string;
}> = [
  { id: "profile", label: "회원정보", component: VerifyIdentityPage, testId: "link-profile" },
  { id: "point", label: "추가 참여", component: PointPage, testId: "link-point" },
  { id: "faq", label: "Q&A", component: FaqPage, testId: "link-faq" },
  { id: "terms", label: "서비스 이용약관", component: TermsOfServicePage, testId: "link-terms" },
];

export const GAME_INFO_WITHDRAW_ITEM: HubMenuItem = {
  id: "withdraw",
  label: "탈퇴하기",
  testId: "link-withdraw",
  danger: true,
};

export function getGameStorySection(id: string | undefined) {
  return GAME_STORY_SECTIONS.find((s) => s.id === id) ?? GAME_STORY_SECTIONS[0];
}

export function getGameInfoSection(id: string | undefined) {
  if (id === GAME_INFO_PROFILE_EDIT_SECTION.id) {
    return GAME_INFO_PROFILE_EDIT_SECTION;
  }
  return GAME_INFO_SECTIONS.find((s) => s.id === id) ?? GAME_INFO_SECTIONS[0];
}

export function getGameInfoMenuActiveId(sectionId: string): string {
  return sectionId === GAME_INFO_PROFILE_EDIT_SECTION.id ? "profile" : sectionId;
}

/** verify 완료 후 프로필 편집 */
export const GAME_INFO_PROFILE_EDIT_SECTION = {
  id: "profile-edit",
  label: "회원정보",
  component: ProfilePage,
  testId: "link-profile-edit",
};
