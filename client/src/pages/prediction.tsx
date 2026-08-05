import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import LandscapeGameShell from "@/components/game/LandscapeGameShell";
import GameSelectModal from "@/components/game/GameSelectModal";
import TodayMatchesSideBetModal from "@/components/game/TodayMatchesSideBetModal";
import SideBetResultOverlay, {
  type SideBetResultLine,
} from "@/components/game/SideBetResultOverlay";
import type { SideBetActionTarget } from "@/components/game/TodayMatchesSideBetModal";
import type { SideBetBottomSummary } from "@/components/game/GameBottomStatusBar";
import type { GameMenuAction } from "@/components/game/GameLeftMenu";
import {
  buildDailyMatchSlots,
  collectStadiumOptions,
  filterJoinableMatches,
  formatMatchTitle,
  formatGameMatchTeamLine,
  resolveGameMatchHeaderLines,
  formatMatchStatusLabel,
  getGameMatchSelectDisabledReason,
  isMatchSelectableForGame,
  sortMatchesByOrder,
  type GameMatchItem,
} from "@/components/game/gameMatchUtils";
import { useToast } from "@/hooks/use-toast";
import { useNowMs } from "@/hooks/useNowMs";
import { useUser } from "@/contexts/UserContext";
import { apiRequest } from "@/lib/queryClient";
import { resolveGameDayPhase, resolveGameTerminalKind } from "@/lib/gameDayPhase";
import {
  formatCountdownMs,
  formatStartTimeKst,
  msUntilMatchStart,
} from "@/lib/matchStartCountdown";
import {
  isSideBetActionEnabled,
  shouldAutoOpenSideBetModal,
} from "@/lib/sideBetMatchUtils";
import type { SideBetRecord } from "@/lib/sideBetMatchUtils";
import { useLiveScoreboard } from "@/hooks/useLiveScoreboard";
import { useLandscapePredictionFlow } from "@/hooks/useLandscapePredictionFlow";
import { keepAliveUserSession } from "@/lib/queryClient";
import { flushDeferredSessionEvents, setGameSessionProtected } from "@/lib/sessionGuard";
import { lockGameLandscape } from "@/lib/gameOrientation";
import { setGameImmersiveMode } from "@/lib/systemUiPlugin";
import { GAME_PATH } from "@/lib/appNavigation";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { navigateToHome, openMallFromApp } from "@/lib/appNavigation";
import { shouldClientPollMatch } from "@/lib/matchPollWindow";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";
import type { LiveScoreboard, CurrentBatterPreview } from "@shared/apiSportsTypes";
import type { InningHalf } from "@shared/gamePhaseTypes";
import { parseInningHalf } from "@shared/gamePhaseTypes";

interface GamePhasePayload {
  gameInning?: number;
  inningHalf?: InningHalf | string;
  batterIndexInHalf?: number;
  displayLabel?: string;
  name?: string;
}

interface SideBetsMeResponse {
  sideBetsLocked: boolean;
  homeTeamName: string | null;
  awayTeamName: string | null;
  bets: SideBetRecord[];
}

export default function PredictionPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const matchEndedHandledRef = useRef(false);
  const [activePanel, setActivePanel] = useState<GameMenuAction | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [liveScoreboard, setLiveScoreboard] = useState<LiveScoreboard | null>(null);
  const [currentBatter, setCurrentBatter] = useState<CurrentBatterPreview | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhasePayload | null>(null);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [stadiumModalOpen, setStadiumModalOpen] = useState(false);
  const [sideBetModalOpen, setSideBetModalOpen] = useState(false);
  const [sideBetAction, setSideBetAction] = useState<SideBetActionTarget | null>(null);
  const [sideBetResult, setSideBetResult] = useState<{
    lines: SideBetResultLine[];
    matchTitle: string;
  } | null>(null);
  const sideBetAutoForMatchRef = useRef<string | null>(null);
  const matchPickPromptedRef = useRef(false);
  const sideBetStatusPrevRef = useRef<Map<number, string>>(new Map());

  const handleGameTerminalComplete = useCallback(() => {
    navigateToHome();
  }, []);

  useEffect(() => {
    void lockGameLandscape();
  }, []);

  /** 게임 중 세션 만료 팝업 차단 + access token 선제 갱신 */
  useEffect(() => {
    setGameSessionProtected(true);
    void keepAliveUserSession();

    const intervalId = window.setInterval(() => {
      void keepAliveUserSession();
    }, 10 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
      setGameSessionProtected(false);
      flushDeferredSessionEvents();
    };
  }, []);

  useEffect(() => {
    void setGameImmersiveMode(true);

    let resumeHandle: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive && window.location.pathname === GAME_PATH) {
          void setGameImmersiveMode(true);
          void keepAliveUserSession();
        }
      }).then((handle) => {
        resumeHandle = handle;
      });
    }

    return () => {
      resumeHandle?.remove();
      void setGameImmersiveMode(false);
    };
  }, []);

  const nowMs = useNowMs();

  const { data: matchesData, isLoading: matchesLoading } = useQuery<GameMatchItem[]>({
    queryKey: ["/api/matches"],
    refetchOnMount: "always",
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      const dayPhase = resolveGameDayPhase(list, false);
      if (dayPhase === "pregame") return 15_000;
      const current = list.find((m) => m.id === selectedMatchId) ?? list[0];
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
    () => filterJoinableMatches(orderedMatches, nowMs),
    [orderedMatches, nowMs],
  );

  const gameDayPhase = useMemo(
    () => resolveGameDayPhase(orderedMatches, matchesLoading, nowMs),
    [orderedMatches, matchesLoading, nowMs],
  );

  const gameTerminalKind = useMemo(
    () => resolveGameTerminalKind(orderedMatches, matchesLoading, nowMs),
    [orderedMatches, matchesLoading, nowMs],
  );

  const viewableMatches = useMemo(
    () => orderedMatches.filter((m) => m.matchStatus !== "cancelled"),
    [orderedMatches],
  );

  const selectedMatch = useMemo(() => {
    if (!selectedMatchId) return null;
    const found = orderedMatches.find((m) => m.id === selectedMatchId);
    if (!found || !isMatchSelectableForGame(found, nowMs)) return null;
    return found;
  }, [orderedMatches, selectedMatchId, nowMs]);

  const displayMatch = selectedMatch;

  const pregameCountdown = useMemo(() => {
    if (gameDayPhase !== "pregame" || !displayMatch?.startTime) return null;
    const remainingMs = msUntilMatchStart(displayMatch.startTime, nowMs);
    if (remainingMs == null) return null;
    return {
      remainingLabel: formatCountdownMs(remainingMs),
      startTimeLabel: formatStartTimeKst(displayMatch.startTime),
    };
  }, [gameDayPhase, displayMatch, nowMs]);

  const flowMatch = gameDayPhase === "live" ? selectedMatch : null;

  const { data: currentSideBets } = useQuery<SideBetsMeResponse>({
    queryKey: ["/api/live-match/matches", displayMatch?.id, "side-bets/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/live-match/matches/${displayMatch!.id}/side-bets/me`);
      return res.json();
    },
    enabled: Boolean(user && displayMatch?.id),
    refetchInterval: (query) => {
      const bets = query.state.data?.bets ?? [];
      return bets.some((b) => b.status === "pending") ? 5_000 : 12_000;
    },
  });

  const { data: todaySideBets } = useQuery<{
    betsByMatch: Record<string, SideBetRecord[]>;
  }>({
    queryKey: ["/api/live-match/side-bets/me/today"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/live-match/side-bets/me/today");
      return res.json();
    },
    enabled: Boolean(user),
    refetchInterval: 8_000,
  });

  const winnerBet = currentSideBets?.bets.find((b) => b.type === "winner");
  const scoreBet = currentSideBets?.bets.find((b) => b.type === "score");
  const hasSideBetPrediction = Boolean(winnerBet || scoreBet);

  const closeSideBetResult = useCallback(() => {
    setSideBetResult(null);
  }, []);

  useEffect(() => {
    if (!todaySideBets?.betsByMatch) return;

    const nextLines: SideBetResultLine[] = [];
    let resultMatchTitle = "";

    for (const [matchId, bets] of Object.entries(todaySideBets.betsByMatch)) {
      for (const bet of bets) {
        const prev = sideBetStatusPrevRef.current.get(bet.id);
        if (prev === undefined) {
          sideBetStatusPrevRef.current.set(bet.id, bet.status);
          continue;
        }
        if (prev === "pending" && bet.status !== "pending") {
          const match = orderedMatches.find((m) => m.id === matchId);
          if (match) resultMatchTitle = formatMatchTitle(match.name);

          if (bet.type === "winner") {
            nextLines.push({
              type: "winner",
              label: bet.winnerPick === "home" ? "홈팀" : "원정팀",
              status: bet.status,
              wonAmount: bet.wonAmount,
            });
          } else {
            nextLines.push({
              type: "score",
              label: `원정(${bet.awayScorePick ?? 0}) : 홈팀(${bet.homeScorePick ?? 0})`,
              status: bet.status,
              wonAmount: bet.wonAmount,
            });
          }
        }
        sideBetStatusPrevRef.current.set(bet.id, bet.status);
      }
    }

    if (nextLines.length > 0) {
      setSideBetResult({ lines: nextLines, matchTitle: resultMatchTitle });
      setSideBetModalOpen(false);
    }
  }, [todaySideBets, orderedMatches]);

  useEffect(() => {
    if (matchesLoading || !displayMatch?.id || currentSideBets === undefined) return;
    if (sideBetAutoForMatchRef.current === displayMatch.id) return;
    sideBetAutoForMatchRef.current = displayMatch.id;

    setSideBetModalOpen(
      shouldAutoOpenSideBetModal(displayMatch, hasSideBetPrediction, nowMs),
    );
  }, [matchesLoading, displayMatch, currentSideBets, hasSideBetPrediction, nowMs]);

  useEffect(() => {
    if (!sideBetModalOpen || !displayMatch) return;
    if (isSideBetActionEnabled(displayMatch, nowMs)) return;
    setSideBetModalOpen(false);
    setSideBetAction(null);
  }, [sideBetModalOpen, displayMatch, nowMs]);

  useEffect(() => {
    if (!gameTerminalKind) return;
    setMatchModalOpen(false);
    setStadiumModalOpen(false);
    setSelectedMatchId(null);
  }, [gameTerminalKind]);

  useEffect(() => {
    if (!selectedMatchId) return;
    const stillViewable = viewableMatches.some((m) => m.id === selectedMatchId);
    if (!stillViewable) {
      setSelectedMatchId(null);
    }
  }, [selectedMatchId, viewableMatches]);

  useEffect(() => {
    if (!selectedMatchId || !selectedMatch) return;
    const found = orderedMatches.find((m) => m.id === selectedMatchId);
    if (found && isMatchSelectableForGame(found, nowMs)) return;
    setSelectedMatchId(null);
    matchPickPromptedRef.current = false;
    setMatchModalOpen(true);
  }, [selectedMatchId, selectedMatch, orderedMatches, nowMs]);

  useEffect(() => {
    if (matchesLoading || matchPickPromptedRef.current) return;
    if (selectedMatchId) return;
    if (gameTerminalKind) return;
    matchPickPromptedRef.current = true;
    setMatchModalOpen(true);
  }, [matchesLoading, selectedMatchId, gameTerminalKind]);

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
    if (resolveGameTerminalKind(matchesData, false, nowMs)) {
      setSelectedMatchId(null);
      return;
    }
    toast({ description: "경기가 종료되었습니다." });
    setSelectedMatchId(null);
  }, [selectedMatchId, matchesData, matchesLoading, toast, nowMs]);

  const flow = useLandscapePredictionFlow(flowMatch, {
    onScoreboardUpdate: setLiveScoreboard,
    onGamePhaseUpdate: (phase) => setGamePhase(phase as GamePhasePayload),
    onMatchEnded: () => {
      matchEndedHandledRef.current = true;
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
    if (scoreboardData !== undefined) {
      setCurrentBatter(scoreboardData.currentBatter ?? null);
    }
  }, [scoreboardData]);

  const shouldPollPhase = selectedMatch
    && shouldClientPollMatch(selectedMatch.startTime, selectedMatch.matchStatus, undefined, nowMs);

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
    () => collectStadiumOptions(viewableMatches),
    [viewableMatches],
  );

  const matchModalItems = useMemo(
    () =>
      buildDailyMatchSlots(orderedMatches).map(({ order, match }) => {
        const label = `제 ${order}경기`;
        if (!match) {
          return {
            id: `slot-${order}`,
            label,
            sublabel: "오늘 경기 없음",
            disabled: true,
          };
        }
        const stadium = getDisplayStadiumName(match.stadiumName, match.homeTeamName);
        const teams = formatGameMatchTeamLine(match);
        const disabledReason = getGameMatchSelectDisabledReason(match);
        const statusPart = disabledReason ?? formatMatchStatusLabel(match, nowMs);
        const parts = [stadium, teams, statusPart].filter(Boolean);
        const selectable = isMatchSelectableForGame(match, nowMs);
        return {
          id: match.id,
          label,
          sublabel: parts.length > 0 ? parts.join(" · ") : undefined,
          disabled: !selectable,
        };
      }),
    [orderedMatches, nowMs],
  );

  const stadiumModalItems = useMemo(
    () =>
      stadiumOptions.map((stadium) => {
        const count = viewableMatches.filter((m) => m.stadiumId === stadium.id).length;
        return {
          id: String(stadium.id),
          label: stadium.name,
          sublabel: count > 1 ? `${count}경기 진행` : undefined,
        };
      }),
    [viewableMatches, stadiumOptions],
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
    if (matchId.startsWith("slot-")) return;
    const match = orderedMatches.find((m) => m.id === matchId);
    if (!match || !isMatchSelectableForGame(match, nowMs)) return;
    setSelectedMatchId(matchId);
    setMatchModalOpen(false);
    sideBetAutoForMatchRef.current = null;
  };

  const handleStadiumSelect = (stadiumIdStr: string) => {
    const stadiumId = Number.parseInt(stadiumIdStr, 10);
    const nextMatch =
      orderedMatches.find(
        (m) => m.stadiumId === stadiumId && isMatchSelectableForGame(m, nowMs),
      ) ?? null;
    if (nextMatch) {
      setSelectedMatchId(nextMatch.id);
      sideBetAutoForMatchRef.current = null;
    }
    setStadiumModalOpen(false);
  };

  const matchTitle = displayMatch ? formatMatchTitle(displayMatch.name) : "경기 선택";
  const stadiumName = getDisplayStadiumName(displayMatch?.stadiumName, displayMatch?.homeTeamName) ?? "";
  const matchHeaderLines = displayMatch
    ? resolveGameMatchHeaderLines(displayMatch, liveScoreboard)
    : { teamNamesLine: null, headToHeadLine: null };
  const canSelectMatch = true;
  const canSelectStadium = stadiumOptions.length > 0;
  const shellDayPhase = gameDayPhase === "loading" ? "pregame" : gameDayPhase;
  const isLivePlay = gameDayPhase === "live";

  const openSideBetSheet = useCallback(
    (betType: "winner" | "score") => {
      if (!displayMatch || !isSideBetActionEnabled(displayMatch, nowMs)) return;
      setSideBetAction({
        matchId: displayMatch.id,
        matchTitle: formatMatchTitle(displayMatch.name),
        betType,
      });
      setSideBetModalOpen(true);
    },
    [displayMatch, nowMs],
  );

  const sideBetSummary = useMemo((): SideBetBottomSummary | null => {
    if (!displayMatch || currentSideBets === undefined) return null;
    const homeName = currentSideBets.homeTeamName?.trim() || "홈팀";
    const awayName = currentSideBets.awayTeamName?.trim() || "원정팀";
    const winnerLabel = winnerBet?.winnerPick
      ? winnerBet.winnerPick === "home"
        ? homeName
        : awayName
      : null;
    const scoreLabel =
      scoreBet?.homeScorePick != null && scoreBet?.awayScorePick != null
        ? `${awayName}(${scoreBet.awayScorePick}) : ${homeName}(${scoreBet.homeScorePick})`
        : null;
    return {
      winnerLabel,
      scoreLabel,
      canEdit: isSideBetActionEnabled(displayMatch, nowMs),
    };
  }, [displayMatch, currentSideBets, winnerBet, scoreBet, nowMs]);

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
        teamNamesLine={matchHeaderLines.teamNamesLine}
        headToHeadLine={matchHeaderLines.headToHeadLine}
        currentBatter={isLivePlay ? currentBatter : null}
        scoreboard={liveScoreboard}
        scoreLoading={scoreLoading && Boolean(selectedMatch)}
        matchesLoading={matchesLoading}
        activePanel={activePanel}
        onMenuSelect={handleMenuSelect}
        onClosePanel={() => setActivePanel(null)}
        todayStats={predictionStats?.statistics?.today}
        statsLoading={statsLoading}
        screenPhase={isLivePlay ? flow.screenPhase : "wait_start"}
        selectedPrediction={isLivePlay ? flow.selectedPrediction : null}
        labelsVisible={isLivePlay && flow.labelsVisible}
        labelsInteractive={isLivePlay && flow.labelsInteractive}
        blinkPrediction={isLivePlay ? flow.blinkPrediction : null}
        onFieldSelect={flow.handleFieldSelect}
        showBetModal={isLivePlay && flow.showBetModal}
        selectedBetAmount={flow.selectedBetAmount}
        onBetAmountChange={flow.setSelectedBetAmount}
        onBetModalCancel={() => {
          flow.setShowBetModal(false);
          flow.handleConfirmCancel();
        }}
        onBetNext={flow.handleBetNext}
        showConfirmModal={isLivePlay && flow.showConfirmModal}
        onConfirmCancel={flow.handleConfirmCancel}
        onConfirmSubmit={() => void flow.handleConfirmSubmit()}
        onRunComplete={flow.handleRunComplete}
        lastWonAmount={flow.lastWonAmount}
        lastBetAmount={flow.lastBetAmount}
        resultCountdown={isLivePlay ? flow.resultCountdown : null}
        eventCountdown={isLivePlay ? flow.eventCountdown : null}
        eventSubtitle={isLivePlay ? flow.eventSubtitle : undefined}
        showAdOverlay={isLivePlay && flow.showAdOverlay}
        adSessionState={flow.adSessionState}
        isNativePlatform={flow.isNativePlatform}
        onMatchTitleClick={() => setMatchModalOpen(true)}
        onStadiumNameClick={() => setStadiumModalOpen(true)}
        matchSelectEnabled={canSelectMatch}
        stadiumSelectEnabled={canSelectStadium}
        inningHalf={inningHalfForUi}
        gameDayPhase={shellDayPhase}
        gameTerminalKind={gameTerminalKind}
        onGameTerminalComplete={handleGameTerminalComplete}
        pregameCountdown={pregameCountdown}
        sideBetSummary={sideBetSummary}
        onSideBetWinnerClick={() => openSideBetSheet("winner")}
        onSideBetScoreClick={() => openSideBetSheet("score")}
      />

      <GameSelectModal
        open={matchModalOpen}
        title="경기 선택"
        items={matchModalItems}
        selectedId={selectedMatch?.id ?? null}
        emptyMessage="오늘 등록된 경기가 없습니다."
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

      <TodayMatchesSideBetModal
        open={sideBetModalOpen}
        matches={orderedMatches}
        loading={matchesLoading}
        initialAction={sideBetAction}
        onClose={() => {
          setSideBetModalOpen(false);
          setSideBetAction(null);
        }}
      />

      {sideBetResult ? (
        <SideBetResultOverlay
          open
          lines={sideBetResult.lines}
          matchTitle={sideBetResult.matchTitle}
          onClose={closeSideBetResult}
        />
      ) : null}
    </>
  );
}
