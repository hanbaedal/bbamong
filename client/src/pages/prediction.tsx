import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import LandscapeGameShell from "@/components/game/LandscapeGameShell";
import GameSelectModal from "@/components/game/GameSelectModal";
import type { GameMenuAction } from "@/components/game/GameLeftMenu";
import {
  collectStadiumOptions,
  filterJoinableMatches,
  formatMatchTitle,
  pickDefaultMatch,
  pickFirstMatchAtStadium,
  sortMatchesByOrder,
  type GameMatchItem,
} from "@/components/game/gameMatchUtils";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { apiRequest } from "@/lib/queryClient";
import { useLiveScoreboard } from "@/hooks/useLiveScoreboard";
import { useLandscapePredictionFlow } from "@/hooks/useLandscapePredictionFlow";
import { lockGameLandscape } from "@/lib/gameOrientation";
import { navigateToHome, openMallFromApp } from "@/lib/appNavigation";
import { shouldClientPollMatch } from "@/lib/matchPollWindow";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";
import type { InningHalf } from "@shared/gamePhaseTypes";
import { parseInningHalf } from "@shared/gamePhaseTypes";

interface GamePhasePayload {
  gameInning?: number;
  inningHalf?: InningHalf | string;
  batterIndexInHalf?: number;
  displayLabel?: string;
  name?: string;
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

export default function PredictionPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const matchEndedHandledRef = useRef(false);
  const [activePanel, setActivePanel] = useState<GameMenuAction | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [liveScoreboard, setLiveScoreboard] = useState<LiveScoreboard | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhasePayload | null>(null);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [stadiumModalOpen, setStadiumModalOpen] = useState(false);

  useEffect(() => {
    void lockGameLandscape();
  }, []);

  const { data: matchesData, isLoading: matchesLoading } = useQuery<GameMatchItem[]>({
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

  const orderedMatches = useMemo(
    () => sortMatchesByOrder(matchesData ?? []),
    [matchesData],
  );

  const joinableMatches = useMemo(
    () => filterJoinableMatches(orderedMatches),
    [orderedMatches],
  );

  const selectedMatch = useMemo(() => {
    if (!joinableMatches.length) return null;
    if (selectedMatchId) {
      return joinableMatches.find((m) => m.id === selectedMatchId) ?? null;
    }
    return pickDefaultMatch(joinableMatches);
  }, [joinableMatches, selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchId) return;
    const stillJoinable = joinableMatches.some((m) => m.id === selectedMatchId);
    if (!stillJoinable) {
      setSelectedMatchId(null);
    }
  }, [selectedMatchId, joinableMatches]);

  useEffect(() => {
    if (!selectedMatchId && selectedMatch?.id) {
      setSelectedMatchId(selectedMatch.id);
    }
  }, [selectedMatch, selectedMatchId]);

  useEffect(() => {
    setLiveScoreboard(null);
    setGamePhase(null);
  }, [selectedMatchId]);

  useEffect(() => {
    matchEndedHandledRef.current = false;
  }, [selectedMatchId]);

  useEffect(() => {
    if (matchesLoading || !selectedMatchId || matchesData === undefined) return;
    if (matchesData.some((m) => m.id === selectedMatchId)) return;
    if (matchEndedHandledRef.current) return;
    matchEndedHandledRef.current = true;
    toast({ description: "경기가 종료되었습니다." });
    navigateToHome();
  }, [selectedMatchId, matchesData, matchesLoading, toast]);

  const flow = useLandscapePredictionFlow(selectedMatch, {
    onScoreboardUpdate: setLiveScoreboard,
    onGamePhaseUpdate: (phase) => setGamePhase(phase as GamePhasePayload),
    onMatchEnded: () => {
      matchEndedHandledRef.current = true;
      navigateToHome();
    },
  });

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

  const { data: predictionStats, isLoading: statsLoading } = useQuery<{
    statistics: { today?: { total: number; wins: number } };
  }>({
    queryKey: ["/api/users/predictions?page=1&limit=1"],
    enabled: activePanel === "story" && Boolean(user),
    refetchOnMount: "always",
  });

  const stadiumOptions = useMemo(
    () => collectStadiumOptions(joinableMatches),
    [joinableMatches],
  );

  const matchModalItems = useMemo(
    () =>
      joinableMatches.map((match) => ({
        id: match.id,
        label: formatMatchTitle(match.name),
        sublabel: getDisplayStadiumName(match.stadiumName) ?? undefined,
      })),
    [joinableMatches],
  );

  const stadiumModalItems = useMemo(
    () =>
      stadiumOptions.map((stadium) => {
        const count = joinableMatches.filter((m) => m.stadiumId === stadium.id).length;
        return {
          id: String(stadium.id),
          label: stadium.name,
          sublabel: count > 1 ? `${count}경기 진행` : undefined,
        };
      }),
    [joinableMatches, stadiumOptions],
  );

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

  const handleMatchSelect = (matchId: string) => {
    setSelectedMatchId(matchId);
    setMatchModalOpen(false);
  };

  const handleStadiumSelect = (stadiumIdStr: string) => {
    const stadiumId = Number.parseInt(stadiumIdStr, 10);
    const nextMatch = pickFirstMatchAtStadium(joinableMatches, stadiumId);
    if (nextMatch) {
      setSelectedMatchId(nextMatch.id);
    }
    setStadiumModalOpen(false);
  };

  const matchTitle = selectedMatch ? formatMatchTitle(selectedMatch.name) : "제 1경기";
  const stadiumName = getDisplayStadiumName(selectedMatch?.stadiumName) ?? "";
  const batterText = batterTextFromPhase(gamePhase);
  const emptyMessage =
    !matchesLoading && joinableMatches.length === 0
      ? "오늘 진행 예정인 경기가 없습니다."
      : undefined;
  const canSelectMatch = joinableMatches.length > 0;
  const canSelectStadium = stadiumOptions.length > 0;

  const inningHalfForUi = useMemo(() => {
    if (gamePhase?.inningHalf != null) {
      return parseInningHalf(String(gamePhase.inningHalf));
    }
    if (liveScoreboard?.inningHalf) {
      return parseInningHalf(String(liveScoreboard.inningHalf));
    }
    return undefined;
  }, [gamePhase, liveScoreboard]);

  return (
    <>
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
        screenPhase={flow.screenPhase}
        selectedPrediction={flow.selectedPrediction}
        labelsVisible={flow.labelsVisible}
        labelsInteractive={flow.labelsInteractive}
        blinkPrediction={flow.blinkPrediction}
        onFieldSelect={flow.handleFieldSelect}
        showBetModal={flow.showBetModal}
        selectedBetAmount={flow.selectedBetAmount}
        onBetAmountChange={flow.setSelectedBetAmount}
        onBetModalCancel={() => {
          flow.setShowBetModal(false);
          flow.handleConfirmCancel();
        }}
        onBetNext={flow.handleBetNext}
        showConfirmModal={flow.showConfirmModal}
        onConfirmCancel={flow.handleConfirmCancel}
        onConfirmSubmit={() => void flow.handleConfirmSubmit()}
        onRunComplete={flow.handleRunComplete}
        lastWonAmount={flow.lastWonAmount}
        lastBetAmount={flow.lastBetAmount}
        resultCountdown={flow.resultCountdown}
        eventCountdown={flow.eventCountdown}
        eventSubtitle={flow.eventSubtitle}
        showAdOverlay={flow.showAdOverlay}
        adSessionState={flow.adSessionState}
        isNativePlatform={flow.isNativePlatform}
        onMatchTitleClick={() => setMatchModalOpen(true)}
        onStadiumNameClick={() => setStadiumModalOpen(true)}
        matchSelectEnabled={canSelectMatch}
        stadiumSelectEnabled={canSelectStadium}
        inningHalf={inningHalfForUi}
      />

      <GameSelectModal
        open={matchModalOpen}
        title="경기 선택"
        items={matchModalItems}
        selectedId={selectedMatch?.id ?? null}
        emptyMessage="오늘 선택 가능한 경기가 없습니다."
        onSelect={handleMatchSelect}
        onClose={() => setMatchModalOpen(false)}
      />

      <GameSelectModal
        open={stadiumModalOpen}
        title="경기장 선택"
        items={stadiumModalItems}
        selectedId={selectedMatch?.stadiumId != null ? String(selectedMatch.stadiumId) : null}
        emptyMessage="오늘 선택 가능한 경기장이 없습니다."
        onSelect={handleStadiumSelect}
        onClose={() => setStadiumModalOpen(false)}
      />
    </>
  );
}
