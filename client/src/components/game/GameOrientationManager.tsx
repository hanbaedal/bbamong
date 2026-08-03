import { useEffect } from "react";
import { useLocation } from "wouter";
import { lockSignupPortrait, setSignupPortraitDocumentClass, syncOrientationForPath } from "@/lib/gameOrientation";

/** /signup 은 세로, 그 외 게임 앱 경로는 가로 (쇼핑몰 /shop 은 MallApp) */
export default function GameOrientationManager() {
  const [location] = useLocation();

  useEffect(() => {
    const base = (location || window.location.pathname).split("?")[0];
    const isSignup = base === "/signup";
    setSignupPortraitDocumentClass(isSignup);
    if (isSignup) {
      void lockSignupPortrait(true);
    } else {
      void syncOrientationForPath(base);
    }

    return () => {
      if (isSignup) {
        setSignupPortraitDocumentClass(false);
      }
    };
  }, [location]);

  return null;
}
