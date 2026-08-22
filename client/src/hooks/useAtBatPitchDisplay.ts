import { useEffect, useMemo, useRef, useState } from "react";
import type { LivePitchLocation, LiveScoreboard } from "@shared/apiSportsTypes";
import type { GameScreenPhase } from "@/components/game/gameTypes";
import {
  isOutcomePresentationPhase,
  isSuccessPresentationPhase,
  isTransientAdOrEventPhase,
} from "@/components/game/gameTypes";

/**
 * 타석 단위 투구 표시 — 예측 중지(wait_result)·결과 큰 글씨(result_flash)에서만 존 점.
 * 시작 전·예측 중·성공/실패 연출에서는 숨김.
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

    const resultEntered = isOutcomePresentationPhase(screenPhase) && screenPhase !== "result_flash";

    const adToWait = prev === "ad_playing" && screenPhase === "wait_start";
    const pickingClosed = prev === "picking" && screenPhase === "wait_start";
    const flashDoneToWait = prev === "result_flash" && screenPhase === "wait_start";

    if ((resultEntered || adToWait || pickingClosed || flashDoneToWait) && batterName) {
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
    // 3번·결과 큰 글씨에서만 투구 점
    if (screenPhase !== "wait_result" && screenPhase !== "result_flash") return null;
    if (isTransientAdOrEventPhase(screenPhase)) return null;
    if (isSuccessPresentationPhase(screenPhase) || screenPhase === "fail") return null;
    if (blockedBatter && blockedBatter === batterName) return null;
    return rawPitches;
  }, [rawPitches, screenPhase, blockedBatter, batterName]);
}
