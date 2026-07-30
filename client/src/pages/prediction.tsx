import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import LandscapeGameShell from "@/components/game/LandscapeGameShell";
import type { GameMenuAction } from "@/components/game/GameLeftMenu";
import { useUser } from "@/contexts/UserContext";
import { apiRequest } from "@/lib/queryClient";
import { useLiveScoreboard } from "@/hooks/useLiveScoreboard";
import { useMatchWebSocket } from "@/hooks/useMatchWebSocket";
import { lockGameLandscape, unlockGameLandscape } from "@/lib/gameOrientation";
import { navigateToHome, openMallFromApp } from "@/lib/appNavigation";
import { shouldClientPollMatch } from "@/lib/matchPollWindow";
import type { LiveScoreboard } from "@shared/apiSportsTypes";

interface MatchData {
  id: string;
  name: string;
  stadiumName: string;
  startTime: string;
  matchStatus: string;
}

interface GamePhasePayload {
  gameInning?: number;
  inningHalf?: string;
  batterIndexInHalf?: number;
  displayLabel?: string;
  name?: string;
}

function formatMatchTitle(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith("제 ")) return trimmed;
  return `제 ${trimmed}`;
}

function batterTextFromPhase(phase: GamePhasePayload | null | undefined): string {
  if (phase?.batterIndexInHalf != null) {
    return `${phase.batterIndexInHalf}번째 타자`;
  }
  if (phase?.displayLabel) {
    const parts = phase.displayLabel.split(" · ");
    const batterPart = parts.find((p) => p.includes("번째"));
    if (batterPart) return batterPart;
  }
  return "—";
}

function matchOrderKey(name: string): number {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function pickDefaultMatch(matches: MatchData[]): MatchData | null {
  if (matches.length === 0) return null;
  const ordered = [...matches].sort(
    (a, b) => matchOrderKey(a.name) - matchOrderKey(b.name),
  );
  return ordered[0] ?? null;
}

export default function PredictionPage() {
  const { user } = useUser();
  const [activePanel, setActivePanel] = useState<GameMenuAction | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [liveScoreboard, setLiveScoreboard] = useState<LiveScoreboard | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhasePayload | null>(null);

  useEffect(() => {
    void lockGameLandscape();
    return () => unlockGameLandscape();
  }, []);

  const { data: matchesData, isLoading: matchesLoading } = useQuery<MatchData[]>({
    queryKey: ["/api/matches"],
    refetchOnMount: "always",
    refetchInterval: (query) => {
      const list = query.state.data;
      const current = list?.find((m) => m.id === selectedMatchId) ?? list?.[0];
      if (!current) return false;
      return shouldClientPollMatch(current.startTime, current.matchStatus) ? 3000 : false;
    },
    refetchIntervalInBackground: false,
  });

  const selectedMatch = useMemo(() => {
    if (!matchesData?.length) return null;
    if (selectedMatchId) {
      return matchesData.find((m) => m.id === selectedMatchId) ?? null;
    }
    return pickDefaultMatch(matchesData);
  }, [matchesData, selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchId && selectedMatch?.id) {
      setSelectedMatchId(selectedMatch.id);
    }
  }, [selectedMatch, selectedMatchId]);

  const { data: scoreboardData, isLoading: scoreLoading } = useLiveScoreboard(
    selectedMatch?.id ?? null,
    {
      startTime: selectedMatch?.startTime,
      matchStatus: selectedMatch?.matchStatus,
    },
  );

  useEffect(() => {
    if (scoreboardData?.scoreboard) {
      setLiveScoreboard(scoreboardData.scoreboard);
    }
  }, [scoreboardData]);

  const shouldPollPhase = selectedMatch
    && shouldClientPollMatch(selectedMatch.startTime, selectedMatch.matchStatus);

  useEffect(() => {
    if (!selectedMatch?.id || !shouldPollPhase) return;

    let stopped = false;

    const fetchPhase = async () => {
      try {
        const res = await apiRequest("GET", `/api/matches/${selectedMatch.id}`);
        if (!res.ok || stopped) return;
        const data = await res.json();
        setGamePhase(data.gamePhase ?? data);
      } catch {
        /* ignore */
      }
    };

    void fetchPhase();
    const id = setInterval(fetchPhase, 3000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [selectedMatch?.id, shouldPollPhase]);

  const handleScoreboardUpdate = useCallback((data: { scoreboard?: LiveScoreboard }) => {
    if (data?.scoreboard) setLiveScoreboard(data.scoreboard);
  }, []);

  const handleRoundNext = useCallback((data: { gamePhase?: GamePhasePayload }) => {
    if (data?.gamePhase) setGamePhase(data.gamePhase);
  }, []);

  useMatchWebSocket({
    matchId: selectedMatch?.id ?? null,
    userId: user?.id ?? null,
    autoConnect: Boolean(selectedMatch?.id && user),
    handlers: {
      onScoreboardUpdate: handleScoreboardUpdate,
      onRoundNext: handleRoundNext,
    },
  });

  const { data: predictionStats, isLoading: statsLoading } = useQuery<{
    statistics: { today?: { total: number; wins: number } };
  }>({
    queryKey: ["/api/users/predictions?page=1&limit=1"],
    enabled: activePanel === "story" && Boolean(user),
    refetchOnMount: "always",
  });

  const handleMenuSelect = (action: GameMenuAction) => {
    if (action === "home") {
      setActivePanel(null);
      navigateToHome();
      return;
    }
    if (action === "mall") {
      setActivePanel(null);
      openMallFromApp();
      return;
    }
    setActivePanel((prev) => (prev === action ? null : action));
  };

  const matchTitle = selectedMatch ? formatMatchTitle(selectedMatch.name) : "제 1경기";
  const stadiumName = selectedMatch?.stadiumName ?? "";
  const batterText = batterTextFromPhase(gamePhase);
  const emptyMessage =
    !matchesLoading && (!matchesData || matchesData.length === 0)
      ? "오늘 진행 예정인 경기가 없습니다."
      : undefined;

  return (
    <LandscapeGameShell
      matchTitle={matchTitle}
      stadiumName={stadiumName}
      batterText={batterText}
      scoreboard={liveScoreboard}
      scoreLoading={scoreLoading && Boolean(selectedMatch)}
      matchesLoading={matchesLoading}
      activePanel={activePanel}
      onMenuSelect={handleMenuSelect}
      onClosePanel={() => setActivePanel(null)}
      todayStats={predictionStats?.statistics?.today}
      statsLoading={statsLoading}
      emptyMessage={emptyMessage}
    />
  );
}
