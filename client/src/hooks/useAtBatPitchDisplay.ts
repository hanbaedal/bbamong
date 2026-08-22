import { useEffect, useMemo, useRef, useState } from "react";
import type { LivePitchLocation, LiveScoreboard } from "@shared/apiSportsTypes";
import type { GameScreenPhase } from "@/components/game/gameTypes";
import {
  isSuccessPresentationPhase,
  isTransientAdOrEventPhase,
} from "@/components/game/gameTypes";

/**
 * 타석 단위 투구 표시 — 결과 확정·광고 복귀 후 이전 구 잔상 제거.
 * 타자가 바뀌거나 새 투구가 추가되면 다시 표시한다.
 */
export function useAtBatPitchDisplay(
  scoreboard: LiveScoreboard | null,
  screenPhase: GameScreenPhase,
): LivePitchLocation[] | null {
  const batterName = scoreboard?.situation?.batterName?.trim() ?? "";
  const rawPitches = scoreboard?.situation?.pitchLocations ?? null;
  const pitchCount = rawPitches?.length ?? 0;

  const [blockedBatter, setBlockedBatter] = useState<string | null>(null);
  const blockedPitchCountRef = useRef(0);
  const prevPhaseRef = useRef(screenPhase);
  const prevBatterRef = useRef(batterName);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = screenPhase;

    const resultEntered =
      isSuccessPresentationPhase(screenPhase) || screenPhase === "fail";

    const adToWait = prev === "ad_playing" && screenPhase === "wait_start";
    const pickingClosed = prev === "picking" && screenPhase === "wait_start";

    if ((resultEntered || adToWait || pickingClosed) && batterName) {
      setBlockedBatter(batterName);
      blockedPitchCountRef.current = pitchCount;
    }
  }, [screenPhase, batterName, pitchCount]);

  useEffect(() => {
    if (batterName && batterName !== prevBatterRef.current) {
      prevBatterRef.current = batterName;
      setBlockedBatter(null);
      blockedPitchCountRef.current = 0;
    }
  }, [batterName]);

  useEffect(() => {
    if (!blockedBatter || blockedBatter !== batterName) return;
    if (pitchCount > blockedPitchCountRef.current) {
      setBlockedBatter(null);
      blockedPitchCountRef.current = 0;
    }
  }, [blockedBatter, batterName, pitchCount]);

  return useMemo(() => {
    if (!rawPitches?.length) return null;
    if (screenPhase === "picking") return null;
    if (screenPhase === "ad_playing" || isTransientAdOrEventPhase(screenPhase)) return null;
    if (isSuccessPresentationPhase(screenPhase) || screenPhase === "fail") return null;
    if (blockedBatter && blockedBatter === batterName) return null;
    return rawPitches;
  }, [rawPitches, screenPhase, blockedBatter, batterName]);
}
