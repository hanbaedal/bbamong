// Admin Assets - 정적 import로 변경
import loginLogo from "@assets/user/로그인로고.svg";
import adEmailIcon from "@assets/admin/adEmail.svg";
import adPasswordIcon from "@assets/admin/ad비번.svg";
import adNameIcon from "@assets/admin/ad이름.svg";
import adPhoneIcon from "@assets/admin/ad전화번호.svg";
import adPermissionPendingIcon from "@assets/admin/ad승인대기.gif";

import adCalanderIcon from "@assets/admin/ad경기달력.svg";
import adListIcon from "@assets/admin/ad회원리스트.svg";

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
import adMatchCharaterIcon from "@assets/admin/ad경기이미지.svg";
import adRightArrowIcon from "@assets/admin/ad우측화살표.svg";
import adFlagIcon from "@assets/admin/ad깃발.svg";

// Admin 전용 assets - 정적으로 export
export const ADMIN_ASSETS = {
  // Login/Auth pages
  loginLogo,
  adEmailIcon,
  adPasswordIcon,
  adNameIcon,
  adPhoneIcon,
  adPermissionPendingIcon,
  
  // Common icons
  adCalanderIcon,
  adListIcon,
  adListIcon_active: adListIcon,

  // Admin sidebar (기본)
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
    
  // 사이드바 활성화 버전
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
  adMatchCharaterIcon,
  adMatchCharaterIcon_active: adMatchCharaterIcon,
  adRightArrowIcon,
  adFlagIcon
} as const;

export type AdminAssetKey = keyof typeof ADMIN_ASSETS;

// 모든 admin assets 가져오기 (단순화)
export function getAllAdminAssets(): Record<AdminAssetKey, string> {
  return ADMIN_ASSETS;
}
