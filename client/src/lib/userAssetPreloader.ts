// User Assets - 정적 import로 변경

// Home page
import mainLogo from "@assets/user/홈예측대기사진.svg";
import baseballLogo from "@assets/user/검은야구공.svg";
import headerLogo from "@assets/user/홈상단로고.svg";
import settingLogo from "@assets/user/설정.svg";
import predictionActiveLogo from "@assets/user/예측하기.svg";
import predictionLogo from "@assets/user/예측하기비활.svg";

// Login page
import loginLogo from "@assets/user/로그인로고.svg";
import kakaoIcon from "@assets/user/카카오.svg";
import googleIcon from "@assets/user/구글.svg";
import appleIcon from "@assets/user/애플.svg";

// Attendance page
import mascotImg from "@assets/user/이번달출석사진.svg";

// Board page
import noCommentImg from "@assets/user/댓글없음짤.gif";
import writingIcon from "@assets/user/글쓰기.svg";

// Advertisement
import coinImg from "@assets/user/광고마크.svg";
import videoImg from "@assets/user/광고시청마크.svg";
import stadiumIcon from "@assets/user/경기장.svg";

// Icons
import iconUsername from "@assets/user/아이디.svg";
import iconName from "@assets/user/이름아이콘.svg";
import iconPassword from "@assets/user/비번.svg";
import iconEmail from "@assets/user/이메일.svg";
import iconPhone from "@assets/user/전화번호.svg";
import iconReferral from "@assets/user/추천인아이콘.svg";
import iconLock from "@assets/user/비번.svg";

// Bottom Navigation
import homeIcon from "@assets/user/home.svg";
import homeActiveIcon from "@assets/user/home-active.svg";
import pointIcon from "@assets/user/point.svg";
import pointActiveIcon from "@assets/user/point-active.svg";
import boardIcon from "@assets/user/board.svg";
import boardActiveIcon from "@assets/user/board-active.svg";
import attendanceIcon from "@assets/user/attendance.svg";
import attendanceActiveIcon from "@assets/user/attendance-active.svg";
import inviteNavIcon from "@assets/user/invite-nav.webp";
import inviteNavActiveIcon from "@assets/user/invite-nav.webp";
import logoutIcon from "@assets/user/logout.svg";
import logoutActiveIcon from "@assets/user/logout-active.svg";

// Loading states
import pendingGif from "@assets/user/예측대기.gif";
import successImg from "@assets/user/예측성공.webp";
import failImg from "@assets/user/예측실패.webp";

// Setting page
import customerServiceIcon from "@assets/user/고객센터.svg";
import termInfoIcon from "@assets/user/서비스이용약관.svg";
import qnaIcon from "@assets/user/큐앤에이.svg";
import withdrawIcon from "@assets/user/탈퇴하기.svg";
import historyIcon from "@assets/user/승리현황.svg";
import informationIcon from "@assets/user/공지사항.svg";
import userInfoIcon from "@assets/user/회원정보.svg";
import ebookServiceIcon from "@assets/user/전자책서비스.svg";
import linkIcon from "@assets/user/오른쪽아래외부링크.svg";
import crownIcon from "@assets/user/승리왕관.svg";
import inviteIcon from "@assets/user/초대하기아이콘.svg";
import phoneInviteIcon from "@assets/user/전화번호초대.svg";
import kakaoInviateIcon from "@assets/user/카톡초대.svg";

// Customer center page
import penIcon from "@assets/user/펜아이콘.svg";

// Victory history page
import victoryImg from "@assets/user/승리현황캐릭터.svg";
import invitationIcon from "@assets/user/초대하기.svg";

// User 전용 assets - 정적으로 export
export const USER_ASSETS = {
  // Home page
  mainLogo,
  baseballLogo,
  headerLogo,
  settingLogo,
  predictionActiveLogo,
  predictionLogo,
  
  // Login page
  loginLogo,
  kakaoIcon,
  googleIcon,
  appleIcon,

  // Attendance page
  mascotImg,

  // Board page
  noCommentImg,
  writingIcon,

  // Advertisement
  coinImg,
  videoImg,
  stadiumIcon,

  // Icons
  iconUsername,
  iconName,
  iconPassword,
  iconEmail,
  iconPhone,
  iconReferral,
  iconLock,

  // Bottom Navigation
  homeIcon,
  homeActiveIcon,
  pointIcon,
  pointActiveIcon,
  boardIcon,
  boardActiveIcon,
  attendanceIcon,
  attendanceActiveIcon,
  inviteNavIcon,
  inviteNavActiveIcon,
  logoutIcon,
  logoutActiveIcon,

  // Loading states
  pendingGif,
  successImg,
  failImg,

  // Setting page
  customerServiceIcon,
  termInfoIcon,
  qnaIcon,
  withdrawIcon,
  historyIcon,
  informationIcon,
  userInfoIcon,
  ebookServiceIcon,
  linkIcon,
  crownIcon,
  inviteIcon,
  phoneInviteIcon,
  kakaoInviateIcon,

  // Customer center page
  penIcon,

  // Victory history page
  victoryImg,
  invitationIcon
} as const;

export type UserAssetKey = keyof typeof USER_ASSETS;

const USER_PRELOAD_IMAGES = [
  successImg,
  failImg,
  pendingGif,
  mainLogo,
  mascotImg,
  coinImg,
  loginLogo,
];

export async function preloadUserAssets(): Promise<void> {
  const promises = USER_PRELOAD_IMAGES.map((src) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
  });
  await Promise.all(promises);
}

export function getAllUserAssets(): Record<UserAssetKey, string> {
  return USER_ASSETS;
}
