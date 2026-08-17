import { useEffect } from "react";
import type { GameDayOverlayKind, GameDayPhase } from "@/lib/gameDayPhase";
import { speakGameVoice, type GameVoiceKey } from "@/lib/gameVoiceAnnouncements";
import {
  clearOverlayVoiceMark,
  consumeLiveMatchVoice,
  consumeOverlayVoice,
  consumePregameMatchVoice,
} from "@/lib/gameVoiceSession";

const OVERLAY_VOICE: Partial<Record<GameDayOverlayKind, GameVoiceKey>> = {
  no_match: "user.noMatch",
  postponed: "user.postponed",
  cancelled: "user.cancelled",
  ended: "user.matchEnded",
};

/** 당일 상태·오버레이 안내 (경기 중 입장 1회, 메뉴 왕복 시 반복 없음) */
export function useGameDayVoice(input: {
  gameDayPhase: GameDayPhase;
  gameDayOverlayKind: GameDayOverlayKind | null;
  selectedMatchId: string | null;
  isLivePlay: boolean;
  matchesLoading: boolean;
}): void {
  useEffect(() => {
    if (input.matchesLoading) return;
    const kind = input.gameDayOverlayKind;
    if (!kind) {
      clearOverlayVoiceMark();
      return;
    }
    if (!consumeOverlayVoice(kind)) return;
    const key = OVERLAY_VOICE[kind];
    if (key) void speakGameVoice(key, 5_000);
  }, [input.gameDayOverlayKind, input.matchesLoading]);

  useEffect(() => {
    if (input.matchesLoading || input.gameDayOverlayKind) return;
    if (input.gameDayPhase !== "pregame" || !input.selectedMatchId) return;
    if (!consumePregameMatchVoice(input.selectedMatchId)) return;
    void speakGameVoice("user.pregame", 5_000);
  }, [
    input.gameDayPhase,
    input.gameDayOverlayKind,
    input.selectedMatchId,
    input.matchesLoading,
  ]);

  useEffect(() => {
    if (input.matchesLoading || input.gameDayOverlayKind) return;
    if (!input.isLivePlay || !input.selectedMatchId) return;
    if (!consumeLiveMatchVoice(input.selectedMatchId)) return;
    void speakGameVoice("user.live", 5_000);
  }, [
    input.isLivePlay,
    input.gameDayOverlayKind,
    input.selectedMatchId,
    input.matchesLoading,
  ]);
}
