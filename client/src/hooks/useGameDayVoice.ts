import { useEffect, useRef } from "react";
import type { GameDayOverlayKind, GameDayPhase } from "@/lib/gameDayPhase";
import { speakGameVoice, type GameVoiceKey } from "@/lib/gameVoiceAnnouncements";

const OVERLAY_VOICE: Partial<Record<GameDayOverlayKind, GameVoiceKey>> = {
  no_match: "user.noMatch",
  postponed: "user.postponed",
  cancelled: "user.cancelled",
  ended: "user.matchEnded",
};

/** 당일 상태·오버레이 안내 (경기 중 입장 1회 등) */
export function useGameDayVoice(input: {
  gameDayPhase: GameDayPhase;
  gameDayOverlayKind: GameDayOverlayKind | null;
  selectedMatchId: string | null;
  isLivePlay: boolean;
  matchesLoading: boolean;
}): void {
  const overlaySpokenRef = useRef<GameDayOverlayKind | null>(null);
  const liveSpokenMatchRef = useRef<string | null>(null);
  const pregameSpokenMatchRef = useRef<string | null>(null);

  useEffect(() => {
    if (input.matchesLoading) return;
    const kind = input.gameDayOverlayKind;
    if (kind && kind !== overlaySpokenRef.current) {
      overlaySpokenRef.current = kind;
      const key = OVERLAY_VOICE[kind];
      if (key) void speakGameVoice(key, 5_000);
    }
    if (!kind) {
      overlaySpokenRef.current = null;
    }
  }, [input.gameDayOverlayKind, input.matchesLoading]);

  useEffect(() => {
    if (input.matchesLoading || input.gameDayOverlayKind) return;
    if (input.gameDayPhase !== "pregame" || !input.selectedMatchId) return;
    if (pregameSpokenMatchRef.current === input.selectedMatchId) return;
    pregameSpokenMatchRef.current = input.selectedMatchId;
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
    if (liveSpokenMatchRef.current === input.selectedMatchId) return;
    liveSpokenMatchRef.current = input.selectedMatchId;
    void speakGameVoice("user.live", 5_000);
  }, [
    input.isLivePlay,
    input.gameDayOverlayKind,
    input.selectedMatchId,
    input.matchesLoading,
  ]);
}
