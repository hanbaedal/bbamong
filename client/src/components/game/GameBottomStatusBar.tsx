import { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { formatKstDisplayDate } from "@/lib/kstDate";

function greetingName(isGuest: boolean, name?: string | null): string {
  if (isGuest) return "게스트";
  const trimmed = name?.trim();
  return trimmed || "회원";
}

/** 게임 화면 하단 — 날짜·인사 (로그아웃은 홈에서) */
export default function GameBottomStatusBar() {
  const { user, isGuest } = useUser();
  const [dateText, setDateText] = useState(() => formatKstDisplayDate());

  useEffect(() => {
    setDateText(formatKstDisplayDate());
    const id = setInterval(() => setDateText(formatKstDisplayDate()), 60_000);
    return () => clearInterval(id);
  }, []);

  const displayName = greetingName(isGuest, user?.name);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[50] flex items-end justify-between px-2 sm:px-3 pb-1.5 sm:pb-2"
      data-testid="game-bottom-status-bar"
    >
      <p
        className="text-[10px] sm:text-xs text-white font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
        data-testid="game-bottom-date"
      >
        {dateText}
      </p>

      <p
        className="text-[10px] sm:text-xs text-white font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
        data-testid="game-bottom-greeting"
      >
        안녕하세요. {displayName}님
      </p>
    </div>
  );
}
