// Manager Assets - 정적 import로 변경
import loginLogo from "@assets/user/로그인로고.svg";
import iconUsername from "@assets/user/아이디.svg";
import iconName from "@assets/user/이름아이콘.svg";
import iconPassword from "@assets/user/비번.svg";
import iconEmail from "@assets/user/이메일.svg";
import iconPhone from "@assets/user/전화번호.svg";

import startPrediction from "@assets/manager/ma예측시작.webp";
import stopPrediction from "@assets/manager/ma예측중지.webp";
import stadiumIcon from "@assets/manager/ma경기장.svg";

// Manager 전용 assets - 정적으로 export
export const MANAGER_ASSETS = {
  // Login/Auth pages
  loginLogo,
  iconUsername,
  iconName,
  iconPassword,
  iconEmail,
  iconPhone,
  
  // Match detail page
  startPrediction,
  stopPrediction,
  stadiumIcon,
} as const;

export type ManagerAssetKey = keyof typeof MANAGER_ASSETS;

// 모든 manager assets 가져오기 (단순화)
export function getAllManagerAssets(): Record<ManagerAssetKey, string> {
  return MANAGER_ASSETS;
}
