import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import LandscapeGameShell from "@/components/game/LandscapeGameShell";
import GameSelectModal from "@/components/game/GameSelectModal";
import TodayMatchesSideBetModal from "@/components/game/TodayMatchesSideBetModal";
import {
  getCurrentFriendRoomId,
  getCurrentFriendRoomName,
} from "@/lib/friendRoomSession";
import "@/styles/friend-rooms.css";
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
  resolveGameMatchHeaderLines,
  formatGameMatchSelectDetail,
  isMatchSelectableForGame,
  sortMatchesByOrder,
  type GameMatchItem,
} from "@/components/game/gameMatchUtils";
import { useToast } from "@/hooks/use-toast";
import { useNowMs } from "@/hooks/useNowMs";
import { useUser } from "@/contexts/UserContext";
import { apiRequest } from "@/lib/queryClient";
import { resolveGameDayOverlayKind, resolveGameDayPhase } from "@/lib/gameDayPhase";
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
import { refreshGameKeepAwake, setGameKeepAwake } from "@/lib/screenWakeLock";
import { handleGameMenuSelect } from "@/lib/gameMenuNavigation";
import { GAME_PATH, navigateToHome } from "@/lib/appNavigation";
import {
  readPersistedSelectedMatchId,
  writePersistedSelectedMatchId,
} from "@/lib/selectedMatchPersistence";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { shouldClientPollMatch } from "@/lib/matchPollWindow";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";
import type { LiveScoreboard, CurrentBatterPreview } from "@shared/apiSportsTypes";
import TeamSeasonStatsModal from "@/components/TeamSeasonStatsModal";
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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const matchEndedHandledRef = useRef(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(() =>
    readPersistedSelectedMatchId(),
  );
  const [liveScoreboard, setLiveScoreboard] = useState<LiveScoreboard | null>(null);
  const [currentBatter, setCurrentBatter] = useState<CurrentBatterPreview | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhasePayload | null>(null);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [stadiumModalOpen, setStadiumModalOpen] = useState(false);
  const [sideBetModalOpen, setSideBetModalOpen] = useState(false);
  const [teamStatsSide, setTeamStatsSide] = useState<"home" | "away" | null>(null);
  const [sideBetAction, setSideBetAction] = useState<SideBetActionTarget | null>(null);
  const [sideBetResult, setSideBetResult] = useState<{
    lines: SideBetResultLine[];
    matchTitle: string;
  } | null>(null);
  const sideBetAutoForMatchRef = useRef<string | null>(null);
  const matchPickPromptedRef = useRef(false);
  const sideBetStatusPrevRef = useRef<Map<number, string>>(new Map());

  // 홈·쇼핑몰 왕복 후에도 당일 선택 경기 유지
  useEffect(() => {
    writePersistedSelectedMatchId(selectedMatchId);
  }, [selectedMatchId]);

  const friendRoomId = getCurrentFriendRoomId();
  const friendRoomName = getCurrentFriendRoomName();

  const goAfterMatchEnd = useCallback(() => {
    const roomId = getCurrentFriendRoomId();
    if (roomId) {
      setLocation(`/home/rooms?open=${encodeURIComponent(roomId)}`);
      return;
    }
    navigateToHome();
  }, [setLocation]);

  const handleGameTerminalComplete = useCallback(() => {
    goAfterMatchEnd();
  }, [goAfterMatchEnd]);

  useEffect(() => {
    void lockGameLandscape();
  }, []);

  /** 게임 중 세션 만료 팝업 차단 + access token 선제 갱신 (15분 JWT → 4분마다 점검) */
  useEffect(() => {
    setGameSessionProtected(true);
    void keepAliveUserSession();

    const intervalId = window.setInterval(() => {
      void keepAliveUserSession();
    }, 4 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
      setGameSessionProtected(false);
      flushDeferredSessionEvents();
    };
  }, []);

  useEffect(() => {
    void setGameImmersiveMode(true);
    void setGameKeepAwake(true);

    let resumeHandle: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive && window.location.pathname === GAME_PATH) {
          void setGameImmersiveMode(true);
          void refreshGameKeepAwake();
          void keepAliveUserSession();
        }
      }).then((handle) => {
        resumeHandle = handle;
      });
    }

    return () => {
      resumeHandle?.remove();
      void setGameImmersiveMode(false);
      void setGameKeepAwake(false);
    };
  }, []);

  const nowMs = useNowMs();

  const {
    data: matchesData,
    isLoading: matchesLoading,
    isError: matchesError,
  } = useQuery<GameMatchItem[]>({
    queryKey: ["/api/matches"],
    staleTime: 30_000,
    refetchInterval: (query) => {
      const list = Array.isArray(query.state.data) ? query.state.data : [];
      const dayPhase = resolveGameDayPhase(list, false);
      if (dayPhase === "no_match") return 30_000;
      if (dayPhase === "pregame") return 15_000;
      const current = list.find((m) => m.id === selectedMatchId) ?? list[0];
      if (!current) return false;
      // WS가 라이브 상태를 담당 — HTTP 목록 폴링은 완화 (429 방지)
      return shouldClientPollMatch(current.startTime, current.matchStatus) ? 10_000 : false;
    },
    refetchIntervalInBackground: false,
  });

  const hasMatchesSnapshot = Array.isArray(matchesData);
  const matchesAwaitingData = !hasMatchesSnapshot && (matchesLoading || matchesError);
  const matchesInitialLoading = matchesLoading && !hasMatchesSnapshot;

  const orderedMatches = useMemo(
    () => sortMatchesByOrder(hasMatchesSnapshot ? matchesData : []),
    [matchesData, hasMatchesSnapshot],
  );

  const joinableMatches = useMemo(
    () => filterJoinableMatches(orderedMatches, nowMs),
    [orderedMatches, nowMs],
  );

  const gameDayPhase = useMemo(
    () => resolveGameDayPhase(orderedMatches, matchesLoading || matchesAwaitingData, nowMs),
    [orderedMatches, matchesLoading, matchesAwaitingData, nowMs],
  );

  const gameDayOverlayKind = useMemo(
    () => resolveGameDayOverlayKind(orderedMatches, matchesLoading || matchesAwaitingData, nowMs),
    [orderedMatches, matchesLoading, matchesAwaitingData, nowMs],
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

  const flowMatch = selectedMatch;

  const { data: currentSideBets } = useQuery<SideBetsMeResponse>({
    queryKey: ["/api/live-match/matches", displayMatch?.id, "side-bets/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/live-match/matches/${displayMatch!.id}/side-bets/me`);
      if (res.status === 429) throw new Error("RATE_LIMITED");
      if (!res.ok) throw new Error(`side-bets/me ${res.status}`);
      return res.json();
    },
    enabled: Boolean(user && displayMatch?.id),
    retry: (failureCount, error) => {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("RATE_LIMITED") || msg.includes("다른 기기") || msg.includes("세션이 만료") || msg.includes("일시적으로 연결")) {
        return false;
      }
      return failureCount < 1;
    },
    refetchInterval: (query) => {
      const err = query.state.error;
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("다른 기기") || msg.includes("세션이 만료") || msg.includes("일시적으로 연결")) {
        return false;
      }
      if (msg.includes("RATE_LIMITED")) return 20_000;
      const bets = query.state.data?.bets ?? [];
      return bets.some((b) => b.status === "pending") ? 8_000 : 20_000;
    },
  });

  const { data: todaySideBets } = useQuery<{
    betsByMatch: Record<string, SideBetRecord[]>;
  }>({
    queryKey: ["/api/live-match/side-bets/me/today"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/live-match/side-bets/me/today");
      if (res.status === 429) throw new Error("RATE_LIMITED");
      if (!res.ok) throw new Error(`side-bets/today ${res.status}`);
      return res.json();
    },
    enabled: Boolean(user),
    retry: (failureCount, error) => {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("RATE_LIMITED") || msg.includes("다른 기기") || msg.includes("세션이 만료") || msg.includes("일시적으로 연결")) {
        return false;
      }
      return failureCount < 1;
    },
    refetchInterval: (query) => {
      const err = query.state.error;
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("다른 기기") || msg.includes("세션이 만료") || msg.includes("일시적으로 연결")) {
        return false;
      }
      if (msg.includes("RATE_LIMITED")) return 20_000;
      return 15_000;
    },
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
    if (!gameDayOverlayKind) return;
    setMatchModalOpen(false);
    setStadiumModalOpen(false);
    setSelectedMatchId(null);
  }, [gameDayOverlayKind]);

  useEffect(() => {
    if (!selectedMatchId) return;
    // 매치 목록 로드 전에는 비어 있어 복원값을 지우면 안 됨
    if (matchesLoading || !hasMatchesSnapshot) return;
    const stillViewable = viewableMatches.some((m) => m.id === selectedMatchId);
    if (!stillViewable) {
      setSelectedMatchId(null);
    }
  }, [selectedMatchId, viewableMatches, matchesLoading, hasMatchesSnapshot]);

  useEffect(() => {
    if (!selectedMatchId) return;
    if (matchesLoading || !hasMatchesSnapshot) return;
    const found = orderedMatches.find((m) => m.id === selectedMatchId);
    if (found && isMatchSelectableForGame(found, nowMs)) return;
    setSelectedMatchId(null);
    matchPickPromptedRef.current = false;
    if (!gameDayOverlayKind) setMatchModalOpen(true);
  }, [
    selectedMatchId,
    orderedMatches,
    nowMs,
    matchesLoading,
    hasMatchesSnapshot,
    gameDayOverlayKind,
  ]);

  useEffect(() => {
    if (matchesLoading || matchesAwaitingData || matchPickPromptedRef.current) return;
    if (selectedMatchId) return;
    if (gameDayOverlayKind) return;
    matchPickPromptedRef.current = true;
    setMatchModalOpen(true);
  }, [matchesLoading, matchesAwaitingData, selectedMatchId, gameDayOverlayKind]);

  useEffect(() => {
    setLiveScoreboard(null);
    setGamePhase(null);
  }, [selectedMatchId]);

  useEffect(() => {
    matchEndedHandledRef.current = false;
  }, [selectedMatchId]);

  useEffect(() => {
    if (matchesLoading || !selectedMatchId || !hasMatchesSnapshot) return;
    if (matchesData.some((m) => m.id === selectedMatchId)) return;
    if (matchEndedHandledRef.current) return;
    matchEndedHandledRef.current = true;
    if (resolveGameDayOverlayKind(matchesData, false, nowMs)) {
      setSelectedMatchId(null);
      return;
    }
    toast({ description: "경기가 종료되었습니다." });
    setSelectedMatchId(null);
    goAfterMatchEnd();
  }, [selectedMatchId, matchesData, hasMatchesSnapshot, matchesLoading, toast, nowMs, goAfterMatchEnd]);

  const flow = useLandscapePredictionFlow(flowMatch, {
    onScoreboardUpdate: setLiveScoreboard,
    onGamePhaseUpdate: (phase) => setGamePhase(phase as GamePhasePayload),
    onMatchEnded: () => {
      matchEndedHandledRef.current = true;
      goAfterMatchEnd();
    },
  });

  const { data: scoreboardData, isLoading: scoreLoading } = useLiveScoreboard(
    selectedMatch?.id ?? null,
    {
      startTime: selectedMatch?.startTime,
      matchStatus: selectedMatch?.matchStatus,
      pollMs: 8_000,
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
    const id = setInterval(fetchPhase, 8000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [selectedMatch?.id, shouldPollPhase]);

  const stadiumOptions = useMemo(
    () => collectStadiumOptions(viewableMatches),
    [viewableMatches],
  );

  const matchModalItems = useMemo(
    () =>
      buildDailyMatchSlots(orderedMatches).map(({ order, match }) => {
        const label = `제${order}경기`;
        if (!match) {
          return {
            id: `slot-${order}`,
            label,
            detail: formatGameMatchSelectDetail(null),
            disabled: true,
          };
        }
        const selectable = isMatchSelectableForGame(match, nowMs);
        return {
          id: match.id,
          label,
          detail: formatGameMatchSelectDetail(match, nowMs),
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
    handleGameMenuSelect(action, setLocation);
  };

  const handleMatchSelect = (matchId: string) => {
    if (matchId.startsWith("slot-")) return;
    const match = orderedMatches.find((m) => m.id === matchId);
    if (!match || !isMatchSelectableForGame(match, nowMs)) return;
    setSelectedMatchId(matchId);
    setMatchModalOpen(false);
    sideBetAutoForMatchRef.current = null;
  };

  /** 경기 미선택 상태에서 닫기/바깥클릭 → 게임 홈. 선택 후 재오픈이면 모달만 닫기 */
  const handleMatchModalClose = useCallback(() => {
    if (selectedMatchId && selectedMatch) {
      setMatchModalOpen(false);
      return;
    }
    navigateToHome();
  }, [selectedMatchId, selectedMatch]);

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

  const matchTitle = displayMatch ? formatMatchTitle(displayMatch.name) : "";
  const stadiumName = getDisplayStadiumName(displayMatch?.stadiumName, displayMatch?.homeTeamName) ?? "";
  const matchHeaderLines = displayMatch
    ? resolveGameMatchHeaderLines(displayMatch, liveScoreboard)
    : { teamNamesLine: null, headToHead: null };
  /** 경기가 선택된 뒤에만 제목 클릭으로 재선택. 미선택 시에는 「경기 선택」 모달만 사용 */
  const canSelectMatch = Boolean(displayMatch);
  const canSelectStadium = Boolean(displayMatch) && stadiumOptions.length > 0;
  const shellDayPhase =
    gameDayPhase === "loading" || gameDayPhase === "no_match" ? "pregame" : gameDayPhase;
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
    // 왼쪽 실황 위젯(▲/▼)과 빠몽이 틴트를 맞추기 위해 실황 초/말 우선
    if (liveScoreboard?.inningHalf) {
      return parseInningHalf(String(liveScoreboard.inningHalf));
    }
    if (gamePhase?.inningHalf != null) {
      return parseInningHalf(String(gamePhase.inningHalf));
    }
    return undefined;
  }, [gamePhase, liveScoreboard]);

  return (
    <>
      <LandscapeGameShell
        matchTitle={matchTitle}
        stadiumName={stadiumName}
        headToHead={matchHeaderLines.headToHead}
        currentBatter={isLivePlay ? currentBatter : null}
        scoreboard={liveScoreboard}
        scoreLoading={Boolean(displayMatch) && scoreLoading}
        matchesInitialLoading={Boolean(displayMatch) && matchesInitialLoading}
        activePanel={null}
        onMenuSelect={handleMenuSelect}
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
        onAdOverlayDismiss={flow.handleAdOverlayDismiss}
        onMatchTitleClick={() => setMatchModalOpen(true)}
        onStadiumNameClick={() => setStadiumModalOpen(true)}
        matchSelectEnabled={canSelectMatch}
        stadiumSelectEnabled={canSelectStadium}
        inningHalf={inningHalfForUi}
        gameDayPhase={shellDayPhase}
        gameDayOverlayKind={gameDayOverlayKind}
        onGameTerminalComplete={handleGameTerminalComplete}
        terminalRedirectLabel={friendRoomId ? "방으로" : "홈으로"}
        friendRoomName={friendRoomName}
        onFriendRoomClick={() => {
          if (!friendRoomId) return;
          setLocation(`/home/rooms?open=${encodeURIComponent(friendRoomId)}`);
        }}
        pregameCountdown={pregameCountdown}
        sideBetSummary={sideBetSummary}
        onSideBetWinnerClick={() => openSideBetSheet("winner")}
        onSideBetScoreClick={() => openSideBetSheet("score")}
        onAwayTeamClick={() => setTeamStatsSide("away")}
        onHomeTeamClick={() => setTeamStatsSide("home")}
        noticeSuppressed={
          matchModalOpen ||
          stadiumModalOpen ||
          sideBetModalOpen ||
          teamStatsSide != null ||
          flow.screenPhase === "ad_playing" ||
          flow.adSessionState !== "idle" ||
          flow.showAdOverlay
        }
      />

      <GameSelectModal
        open={matchModalOpen}
        title="경기 선택"
        layout="table"
        items={matchModalItems}
        selectedId={selectedMatch?.id ?? null}
        emptyMessage="오늘 등록된 경기가 없습니다."
        onSelect={handleMatchSelect}
        onClose={handleMatchModalClose}
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
        loading={matchesInitialLoading}
        initialAction={sideBetAction}
        onClose={() => {
          setSideBetModalOpen(false);
          setSideBetAction(null);
        }}
      />

      {teamStatsSide ? (
        <TeamSeasonStatsModal
          open
          teamName={
            teamStatsSide === "away"
              ? matchHeaderLines.headToHead?.awayName ||
                liveScoreboard?.awayTeamName ||
                "원정팀"
              : matchHeaderLines.headToHead?.homeName ||
                liveScoreboard?.homeTeamName ||
                "홈팀"
          }
          stats={
            (teamStatsSide === "away"
              ? scoreboardData?.teamSeasonStats?.away
              : scoreboardData?.teamSeasonStats?.home) ?? null
          }
          onClose={() => setTeamStatsSide(null)}
        />
      ) : null}

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
