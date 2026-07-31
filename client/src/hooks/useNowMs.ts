import { useEffect, useState } from "react";

/** 1초 tick — pregame 카운트다운·phase 전환용 */
export function useNowMs(enabled = true): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);

  return nowMs;
}
