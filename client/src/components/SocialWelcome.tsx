import { useEffect, useRef } from "react";
import welcomeIcon from "@assets/user/social-welcome-icon.webp";

interface SocialWelcomeProps {
  onContinue: () => void;
}

export default function SocialWelcome({ onContinue }: SocialWelcomeProps) {
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      onContinueRef.current();
    }, 2000);
    return () => {
      document.body.style.overflow = "";
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-[#111111] flex items-center justify-center z-[9999]"
      data-testid="social-welcome-screen"
    >
      <div className="flex flex-col items-center gap-[30px] w-[292px]">
        <img
          src={welcomeIcon}
          alt="Welcome"
          className="w-[94px] h-[110px] object-contain"
          data-testid="img-welcome-icon"
        />
        <p
          className="w-full text-center text-[#AAAAAA] text-[15px] font-normal leading-[140%] tracking-[-0.025em]"
          style={{ fontFamily: "Pretendard, sans-serif" }}
          data-testid="text-welcome-message"
        >
          본 게임은 15세 이상 이용가입니다. 이용 약관 및 정책에 따라 서비스 이용이 제한됩니다.
        </p>
      </div>
    </div>
  );
}
