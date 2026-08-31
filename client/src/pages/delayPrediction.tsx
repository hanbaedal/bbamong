import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import LandscapeGameShell from "@/components/game/LandscapeGameShell";
import GameSelectModal from "@/components/game/GameSelectModal";
import type { GameMenuAction } from "@/components/game/GameLeftMenu";
import {
  buildDailyMatchSlots,
  collectStadiumOptions,
  formatMatchTitle,
  resolveGameMatchHeaderLines,
  formatGameMatchSelectTeamLine,
  sortMatchesByOrder,
  type GameMatchItem,
} from "@/components/game/gameMatchUtils";
import { useToast } from "@/hooks/use-toast";
import { useNowMs } from "@/hooks/useNowMs";
import { useUser } from "@/contexts/UserContext";
import { keepAliveUserSession } from "@/lib/queryClient";
import { flushDeferredSessionEvents, setGameSessionProtected } from "@/lib/sessionGuard";
import { lockGameLandscape } from "@/lib/gameOrientation";
import { setGameImmersiveMode } from "@/lib/systemUiPlugin";
import { refreshGameKeepAwake, setGameKeepAwake } from "@/lib/screenWakeLock";
import { handleGameMenuSelect } from "@/lib/gameMenuNavigation";
import { navigateToHome } from "@/lib/appNavigation";
import {
  readPersistedDelayMatchId,
  writePersistedDelayMatchId,
} from "@/lib/delaySelectedMatch";
import { subscribeForegroundResume } from "@/lib/foregroundResume";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";
import type { CurrentBatterPreview, LiveScoreboard } from "@shared/apiSportsTypes";
import { parseInningHalf } from "@shared/gamePhaseTypes";
import { DELAY_GAME_PATH, DELAY_LIVE_BLOCK_MESSAGE } from "@shared/delayGame";
import { MATCH_STATUS_LABEL } from "@shared/matchStatusLabels";
import { resolveGameDayPhase, type GameDayOverlayKind } from "@/lib/gameDayPhase";
import { useDelayGameFlow, type DelayMyPrediction, type DelayStatePayload } from "@/hooks/useDelayGameFlow";

type DelayMatchItem = GameMatchItem & {
  liveParticipated?: boolean;
  delayPhase?: string | null;
};

type DelayStateResponse = {
  serverNow: number;
  blocked: boolean;
  blockedMessage: string | null;
  match: DelayMatchItem;
  delay: DelayStatePayload | null;
  myPrediction: DelayMyPrediction | null;
};

function isDelaySelectable(match: DelayMatchItem): boolean {
  if (match.liveParticipated) return false;
  if (match.matchStatus === "cancelled" || match.matchStatus === "취소") return false;
  if (match.matchStatus === "completed" || match.matchStatus === "종료") return false;
  return true;
}

function delaySelectDetail(match: DelayMatchItem): string {
  const stadium = getDisplayStadiumName(match.stadiumName, match.homeTeamName);
  const teams = formatGameMatchSelectTeamLine(match);
  if (match.liveParticipated) {
    return `${stadium ? `${stadium}, ` : ""}${teams} ${DELAY_LIVE_BLOCK_MESSAGE}`;
  }
  const status =
    match.matchStatus === "ongoing"
      ? MATCH_STATUS_LABEL.live
      : match.matchStatus === "completed"
        ? MATCH_STATUS_LABEL.finished
        : MATCH_STATUS_LABEL.scheduled;
  return `${stadium ? `${stadium}, ` : ""}${teams} ${status}`;
}

function delayDayOverlayKind(matches: DelayMatchItem[], loading: boolean): GameDayOverlayKind | null {
  if (loading) return null;
  if (matches.length === 0) return "no_match";
  if (matches.some(isDelaySelectable)) return null;
  if (matches.every((m) => m.matchStatus === "cancelled" || m.matchStatus === "취소")) return "cancelled";
  return "ended";
}

function batterFromScoreboard(scoreboard: LiveScoreboard | null): CurrentBatterPreview | null {
  const name = scoreboard?.situation?.batterName?.trim();
  if (!name) return null;
  const today = scoreboard.situation?.batterToday;
  return {
    orderLabel: name,
    playerName: name,
    battingAverage: null,
    hits: today?.hits ?? null,
    homeRuns: today?.homeRuns ?? null,
    rbi: today?.rbi ?? null,
    ops: null,
    runs: today?.runs ?? null,
    season: new Date().getFullYear(),
    batsSide: scoreboard.situation?.batsSide ?? null,
  };
}

export default function DelayPredictionPage() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const nowMs = useNowMs();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(() =>
    readPersistedDelayMatchId(),
  );
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [stadiumModalOpen, setStadiumModalOpen] = useState(false);
  const blockedToastRef = useRef<string | null>(null);

  useEffect(() => {
    writePersistedDelayMatchId(selectedMatchId);
  }, [selectedMatchId]);

  useEffect(() => {
    void lockGameLandscape();
  }, []);

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
    const unsubscribe = subscribeForegroundResume(() => {
      if (window.location.pathname !== DELAY_GAME_PATH) return;
      void setGameImmersiveMode(true);
      void refreshGameKeepAwake();
      void keepAliveUserSession();
    });
    return () => {
      unsubscribe();
      void setGameImmersiveMode(false);
      void setGameKeepAwake(false);
    };
  }, []);

  const {
    data: matchesData,
    isLoading: matchesLoading,
  } = useQuery<DelayMatchItem[]>({
    queryKey: ["/api/delay-game/matches"],
    staleTime: 8_000,
    refetchInterval: 8_000,
    refetchIntervalInBackground: false,
  });

  const hasMatchesSnapshot = Array.isArray(matchesData);
  const orderedMatches = useMemo(
    () => sortMatchesByOrder(hasMatchesSnapshot ? matchesData : []),
    [matchesData, hasMatchesSnapshot],
  );

  const gameDayPhase = useMemo(
    () => resolveGameDayPhase(orderedMatches, matchesLoading && !hasMatchesSnapshot, nowMs),
    [orderedMatches, matchesLoading, hasMatchesSnapshot, nowMs],
  );

  const gameDayOverlayKind = useMemo(
    () => delayDayOverlayKind(orderedMatches, matchesLoading && !hasMatchesSnapshot),
    [orderedMatches, matchesLoading, hasMatchesSnapshot],
  );

  const { data: stateData } = useQuery<DelayStateResponse>({
    queryKey: [`/api/delay-game/${selectedMatchId}/state`],
    enabled: Boolean(selectedMatchId && user),
    refetchInterval: 1_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const selectedMatch = useMemo(() => {
    if (stateData?.match) return stateData.match;
    if (!selectedMatchId) return null;
    return orderedMatches.find((m) => m.id === selectedMatchId) ?? null;
  }, [stateData?.match, selectedMatchId, orderedMatches]);

  const liveScoreboard = (stateData?.match?.liveScoreboard ??
    selectedMatch?.liveScoreboard ??
    null) as LiveScoreboard | null;

  const flow = useDelayGameFlow({
    matchId: selectedMatchId,
    delay: stateData?.delay ?? null,
    myPrediction: stateData?.myPrediction ?? null,
    blocked: Boolean(stateData?.blocked),
    serverNow: stateData?.serverNow ?? null,
  });

  useEffect(() => {
    if (!stateData?.blocked || !selectedMatchId) return;
    if (blockedToastRef.current === selectedMatchId) return;
    blockedToastRef.current = selectedMatchId;
    toast({ description: stateData.blockedMessage || DELAY_LIVE_BLOCK_MESSAGE, duration: 5000 });
  }, [stateData?.blocked, stateData?.blockedMessage, selectedMatchId, toast]);

  useEffect(() => {
    if (matchesLoading || selectedMatchId) return;
    if (!hasMatchesSnapshot) return;
    const playable = orderedMatches.filter(isDelaySelectable);
    if (playable.length === 1) {
      setSelectedMatchId(playable[0].id);
      return;
    }
    if (!matchModalOpen) setMatchModalOpen(true);
  }, [matchesLoading, selectedMatchId, hasMatchesSnapshot, orderedMatches, matchModalOpen]);

  const stadiumOptions = useMemo(
    () => collectStadiumOptions(orderedMatches.filter(isDelaySelectable)),
    [orderedMatches],
  );

  const matchModalItems = useMemo(
    () =>
      buildDailyMatchSlots(orderedMatches).map(({ order, match }) => {
        const label = `제${order}경기`;
        if (!match) {
          return { id: `slot-${order}`, label, detail: MATCH_STATUS_LABEL.noMatchToday, disabled: true };
        }
        return {
          id: match.id,
          label,
          detail: delaySelectDetail(match),
          disabled: !isDelaySelectable(match),
        };
      }),
    [orderedMatches],
  );

  const stadiumModalItems = useMemo(
    () =>
      stadiumOptions.map((stadium) => {
        const count = orderedMatches.filter((m) => m.stadiumId === stadium.id && isDelaySelectable(m)).length;
        return {
          id: String(stadium.id),
          label: stadium.name,
          sublabel: count > 1 ? `${count}경기` : undefined,
        };
      }),
    [orderedMatches, stadiumOptions],
  );

  const handleMenuSelect = (action: GameMenuAction) => {
    handleGameMenuSelect(action, setLocation);
  };

  const handleMatchSelect = (matchId: string) => {
    if (matchId.startsWith("slot-")) return;
    const match = orderedMatches.find((m) => m.id === matchId);
    if (!match || !isDelaySelectable(match)) {
      if (match?.liveParticipated) {
        toast({ description: DELAY_LIVE_BLOCK_MESSAGE, duration: 4000 });
      }
      return;
    }
    setSelectedMatchId(matchId);
    setMatchModalOpen(false);
  };

  const handleMatchModalClose = useCallback(() => {
    if (selectedMatchId || selectedMatch) {
      setMatchModalOpen(false);
      return;
    }
    navigateToHome();
  }, [selectedMatchId, selectedMatch]);

  const handleStadiumSelect = (stadiumIdStr: string) => {
    const stadiumId = Number.parseInt(stadiumIdStr, 10);
    const nextMatch =
      orderedMatches.find((m) => m.stadiumId === stadiumId && isDelaySelectable(m)) ?? null;
    if (nextMatch) setSelectedMatchId(nextMatch.id);
    setStadiumModalOpen(false);
  };

  const matchTitle = selectedMatch ? formatMatchTitle(selectedMatch.name) : "딜레이 예측게임";
  const stadiumName = getDisplayStadiumName(selectedMatch?.stadiumName, selectedMatch?.homeTeamName) ?? "";
  const matchHeaderLines = selectedMatch
    ? resolveGameMatchHeaderLines(selectedMatch, liveScoreboard)
    : { teamNamesLine: null, headToHead: null };
  const canSelectMatch = orderedMatches.some(isDelaySelectable);
  const canSelectStadium = Boolean(selectedMatch) && stadiumOptions.length > 0;
  const inningHalfForUi = liveScoreboard?.inningHalf
    ? parseInningHalf(String(liveScoreboard.inningHalf))
    : undefined;
  const isMatchEndSequence = flow.screenPhase === "match_ended";
  const displayMatch = Boolean(selectedMatch);
  const shellDayPhase =
    !displayMatch && gameDayPhase !== "all_ended"
      ? "pregame"
      : gameDayPhase === "loading" || gameDayPhase === "no_match"
        ? "pregame"
        : gameDayPhase;
  const shellScreenPhase = isMatchEndSequence
    ? "match_ended"
    : displayMatch
      ? flow.screenPhase
      : "wait_start";

  return (
    <>
      <LandscapeGameShell
        matchTitle={matchTitle}
        stadiumName={stadiumName}
        headToHead={matchHeaderLines.headToHead}
        currentBatter={displayMatch ? batterFromScoreboard(liveScoreboard) : null}
        scoreboard={liveScoreboard}
        scoreLoading={Boolean(displayMatch) && !liveScoreboard}
        matchesInitialLoading={matchesLoading && !hasMatchesSnapshot}
        activePanel={null}
        onMenuSelect={handleMenuSelect}
        screenPhase={shellScreenPhase}
        selectedPrediction={displayMatch ? flow.selectedPrediction : null}
        roundResultLabel={displayMatch ? flow.roundResultLabel : null}
        labelsVisible={displayMatch && flow.labelsVisible}
        labelsInteractive={displayMatch && flow.labelsInteractive}
        blinkPrediction={displayMatch ? flow.blinkPrediction : null}
        onFieldSelect={flow.handleFieldSelect}
        showBetModal={displayMatch && flow.showBetModal}
        selectedBetAmount={flow.selectedBetAmount}
        onBetAmountChange={flow.setSelectedBetAmount}
        onBetModalCancel={flow.handleBetModalCancel}
        onBetSubmit={() => void flow.handleBetSubmit()}
        onRunComplete={flow.handleRunComplete}
        lastWonAmount={flow.lastWonAmount}
        lastBetAmount={flow.lastBetAmount}
        resultCountdown={displayMatch ? flow.resultCountdown : null}
        eventCountdown={displayMatch ? flow.eventCountdown : null}
        eventSubtitle={displayMatch ? flow.eventSubtitle : undefined}
        showAdOverlay={displayMatch && flow.showAdOverlay}
        adOverlayMessage={flow.adOverlayMessage}
        adOverlayDismissible={flow.adOverlayDismissible}
        adOverlayCompleteAfterSeconds={flow.adOverlayCompleteAfterSeconds}
        onAdOverlayDismiss={flow.handleAdOverlayDismiss}
        onAdOverlayComplete={flow.handleAdOverlayComplete}
        onMatchTitleClick={() => setMatchModalOpen(true)}
        onStadiumNameClick={() => setStadiumModalOpen(true)}
        matchSelectEnabled={canSelectMatch}
        stadiumSelectEnabled={canSelectStadium}
        inningHalf={inningHalfForUi}
        gameDayPhase={shellDayPhase}
        gameDayOverlayKind={isMatchEndSequence ? null : gameDayOverlayKind}
        onGameTerminalComplete={() => navigateToHome()}
        terminalRedirectLabel="홈으로"
        noticeSuppressed={
          matchModalOpen ||
          stadiumModalOpen ||
          flow.showBetModal ||
          flow.screenPhase === "ad_playing" ||
          flow.showAdOverlay
        }
      />

      <GameSelectModal
        open={matchModalOpen}
        title="딜레이 경기 선택"
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
    </>
  );
}
