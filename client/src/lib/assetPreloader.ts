// User Assets - 정적 import로 변경 (WebView suspend 시에도 유지됨)

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
import coinImg from "@assets/user/광고마크.svg";
import videoImg from "@assets/user/광고시청마크.svg";

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

// Customer center page
import penIcon from "@assets/user/펜아이콘.svg";

// Victory history page
import victoryImg from "@assets/user/승리현황캐릭터.svg";

// Admin icons (used in some user pages like login)
import adEmailIcon from "@assets/admin/adEmail.svg";
import adPasswordIcon from "@assets/admin/ad비번.svg";
import adNameIcon from "@assets/admin/ad이름.svg";
import adPhoneIcon from "@assets/admin/ad전화번호.svg";
import adPermissionPendingIcon from "@assets/admin/ad승인대기.gif";
import adCalanderIcon from "@assets/admin/ad경기달력.svg";

// Admin sidebar icons
import adMatchIcon from "@assets/admin/ad경기관리.svg";
import adMemberIcon from "@assets/admin/ad회원관리.svg";
import adCustomerIcon from "@assets/admin/ad고객지원센터.svg";
import adDonationPointIcon from "@assets/admin/ad기부포인트관리.svg";
import adNoticeIcon from "@assets/admin/ad공지사항.svg";
import adMangerListIcon from "@assets/admin/ad운영자리스트.svg";
import adManagerMatchIcon from "@assets/admin/ad운영자경기할당관리.svg";
import adManagerMonitoringIcon from "@assets/admin/ad운영자상태모니터링.svg";
import adInviteFriendIcon from "@assets/admin/ad친구초대관리.svg";
import adUserListIcon from "@assets/admin/ad회원리스트사이드바.svg";
import adTermIcon from "@assets/admin/ad약관관리.svg";
import adBannerProfitIcon from "@assets/admin/ad배너광고수익현황.svg";
import adVideoProfitIcon from "@assets/admin/ad동영상광고수익현황.svg";
import adProfitIcon from "@assets/admin/ad수익관리.svg";
import adEmployeeIcon from "@assets/admin/ad직원리스트.svg";
import adWinRankingIcon from "@assets/admin/ad승리랭킹.svg";
import adWinPointRankingIcon from "@assets/admin/ad승리포인트랭킹.svg";
import adPendingGifManagementIcon from "@assets/admin/ad예측대기관리.svg";
import adAdvertisementIcon from "@assets/admin/ad동영상광고관리.svg";
import adListIcon from "@assets/admin/ad회원리스트.svg";

// Admin sidebar active icons
import adMatchIcon_active from "@assets/admin/ad경기관리_active.svg";
import adMemberIcon_active from "@assets/admin/ad회원관리_active.svg";
import adCustomerIcon_active from "@assets/admin/ad고객지원센터_active.svg";
import adDonationPointIcon_active from "@assets/admin/ad기부포인트관리_active.svg";
import adNoticeIcon_active from "@assets/admin/ad공지사항_active.svg";
import adMangerListIcon_active from "@assets/admin/ad운영자리스트_active.svg";
import adManagerMatchIcon_active from "@assets/admin/ad운영자경기할당관리_active.svg";
import adManagerMonitoringIcon_active from "@assets/admin/ad운영자상태모니터링_active.svg";
import adInviteFriendIcon_active from "@assets/admin/ad친구초대관리_active.svg";
import adUserListIcon_active from "@assets/admin/ad회원리스트사이드바_active.svg";
import adTermIcon_active from "@assets/admin/ad약관관리_active.svg";
import adBannerProfitIcon_active from "@assets/admin/ad배너광고수익현황_active.svg";
import adVideoProfitIcon_active from "@assets/admin/ad동영상광고수익현황_active.svg";
import adProfitIcon_active from "@assets/admin/ad수익관리_active.svg";
import adEmployeeIcon_active from "@assets/admin/ad직원리스트_active.svg";
import adWinRankingIcon_active from "@assets/admin/ad승리랭킹_active.svg";
import adWinPointRankingIcon_active from "@assets/admin/ad승리포인트랭킹_active.svg";
import adPendingGifManagementIcon_active from "@assets/admin/ad예측대기관리_active.svg";
import adAdvertisementIcon_active from "@assets/admin/ad동영상광고관리_active.svg";

// User 전용 assets - 정적으로 export
export const ASSETS = {
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
  coinImg,
  videoImg,

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

  // Customer center page
  penIcon,

  // Victory history page
  victoryImg,

  // Admin icons (used in some user pages)
  adEmailIcon,
  adPasswordIcon,
  adNameIcon,
  adPhoneIcon,
  adPermissionPendingIcon,
  adCalanderIcon,

  // Admin sidebar
  adMatchIcon,
  adMemberIcon,
  adCustomerIcon,
  adDonationPointIcon,
  adNoticeIcon,
  adMangerListIcon,
  adManagerMatchIcon,
  adManagerMonitoringIcon,
  adInviteFriendIcon,
  adUserListIcon,
  adTermIcon,
  adBannerProfitIcon,
  adVideoProfitIcon,
  adProfitIcon,
  adEmployeeIcon,
  adWinRankingIcon,
  adWinPointRankingIcon,
  adPendingGifManagementIcon,
  adAdvertisementIcon,
  adListIcon,

  // 사이드바 활성화버전
  adMatchIcon_active,
  adMemberIcon_active,
  adCustomerIcon_active,
  adDonationPointIcon_active,
  adNoticeIcon_active,
  adMangerListIcon_active,
  adManagerMatchIcon_active,
  adManagerMonitoringIcon_active,
  adInviteFriendIcon_active,
  adUserListIcon_active,
  adTermIcon_active,
  adBannerProfitIcon_active,
  adVideoProfitIcon_active,
  adProfitIcon_active,
  adEmployeeIcon_active,
  adWinRankingIcon_active,
  adWinPointRankingIcon_active,
  adPendingGifManagementIcon_active,
  adAdvertisementIcon_active,
} as const;

export type AssetKey = keyof typeof ASSETS;

const PRELOAD_IMAGES = [
  successImg,
  failImg,
  pendingGif,
  mainLogo,
  mascotImg,
  coinImg,
  loginLogo,
];

export async function preloadAssets(): Promise<void> {
  const promises = PRELOAD_IMAGES.map((src) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
  });
  await Promise.all(promises);
}

// 캐시된 asset URL 가져오기
export function getAsset(key: AssetKey): string {
  return ASSETS[key] || "";
}

// 모든 캐시된 assets 가져오기
export function getAllAssets(): Record<AssetKey, string> {
  return ASSETS;
}
