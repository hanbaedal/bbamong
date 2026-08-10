import type { ComponentType } from "react";
import AttendanceCompact from "@/components/landscape/compact/AttendanceCompact";
import EbookCompact from "@/components/landscape/compact/EbookCompact";
import FaqCompact from "@/components/landscape/compact/FaqCompact";
import PointCompact from "@/components/landscape/compact/PointCompact";
import ProfileCompact from "@/components/landscape/compact/ProfileCompact";
import TermsCompact from "@/components/landscape/compact/TermsCompact";
import VerifyIdentityCompact from "@/components/landscape/compact/VerifyIdentityCompact";
import DonationHistoryPage from "@/pages/setting/donation-history";
import InvitePage from "@/pages/setting/invite";
import VictoryHistoryPage from "@/pages/setting/victory-history";
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
  { id: "attendance", label: "출석 체크", component: AttendanceCompact, testId: "link-attendance" },
  { id: "ebook", label: "나의 콘텐츠", component: EbookCompact, testId: "link-ebook" },
  { id: "donation", label: "사회공헌 참여현황", component: DonationHistoryPage, testId: "link-donation" },
];

export const GAME_INFO_SECTIONS: Array<{
  id: string;
  label: string;
  component: ComponentType;
  testId: string;
}> = [
  { id: "profile", label: "회원정보", component: VerifyIdentityCompact, testId: "link-profile" },
  { id: "point", label: "추가 참여", component: PointCompact, testId: "link-point" },
  { id: "faq", label: "Q&A", component: FaqCompact, testId: "link-faq" },
  { id: "terms", label: "서비스 이용약관", component: TermsCompact, testId: "link-terms" },
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
  component: ProfileCompact,
  testId: "link-profile-edit",
};
