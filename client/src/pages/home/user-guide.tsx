import { useEffect } from "react";
import { useLocation } from "wouter";

export const USER_GUIDE_OPEN_KEY = "ppamong_open_user_guide";

/** 레거시 /home/guide — 홈으로 이동 후 좌측 패널 모달을 연다 */
export default function UserGuidePage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    sessionStorage.setItem(USER_GUIDE_OPEN_KEY, "1");
    setLocation("/home");
  }, [setLocation]);

  return null;
}
