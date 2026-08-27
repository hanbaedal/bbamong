import GameFieldViewport from "./GameFieldViewport";
import GameLeftMenu, { type GameMenuAction } from "./GameLeftMenu";
import GameTopScorePanel from "./GameTopScorePanel";
import GamePregameCountdown from "./GamePregameCountdown";
import GameDayStatusOverlay from "./GameDayStatusOverlay";
import GameFieldLabels from "./GameFieldLabels";
import GameCharacterLayer from "./GameCharacterLayer";
import GameDefenseLayer from "./GameDefenseLayer";
import GameConfetti from "./GameConfetti";
import GameBottomStatusBar from "./GameBottomStatusBar";
import GameBetModal from "./GameBetModal";
import GameResultBanner from "./GameResultBanner";
import GameRoundResultFlash from "./GameRoundResultFlash";
import GameEventOverlay from "./GameEventOverlay";
import GameAdOverlay from "./GameAdOverlay";
import GameLiveSituationWidget from "./GameLiveSituationWidget";
import GameStrikeZoneOverlay from "./GameStrikeZoneOverlay";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";
import { useUser } from "@/contexts/UserContext";
import type { HeadToHeadDisplayParts } from "@shared/matchTeamDisplay";
import type { AdSessionState } from "@/hooks/useAdMob";
import type { LiveScoreboard, CurrentBatterPreview, LivePitcherSummary } from "@shared/apiSportsTypes";
import type { GameDayOverlayKind, GameDayPhase } from "@/lib/gameDayPhase";
import type { PregameCountdownDisplay } from "./GamePregameCountdown";
import type { SideBetBottomSummary } from "./GameBottomStatusBar";
import { AD_PLAY_MS } from "@shared/adBreakTiming";
import type { BetAmountOption } from "@shared/predictionOdds";
import { isTransientAdOrEventPhase, type GameScreenPhase, type PredictionOption } from "./gameTypes";
import { useAtBatPitchDisplay } from "@/hooks/useAtBatPitchDisplay";
import { resolveGameSceneKind, shouldMirrorCinematic } from "./gameSceneBackground";
import {
  CINEMATIC_SCENE_IMAGE,
  HOME_PLATE_IMAGE,
  maybeMirrorImagePointX,
  PITCH_AWAY_PLATE_IMAGE,
  PITCH_HOME_PLATE_IMAGE,
} from "./stadiumFieldCoords";
import "./gameAnimations.css";

interface LandscapeGameShellProps {
  matchTitle: string;
  stadiumName: string;
  headToHead?: HeadToHeadDisplayParts | null;
  currentBatter?: CurrentBatterPreview | null;
  scoreboard: LiveScoreboard | null;
  scoreLoading?: boolean;
  matchesInitialLoading?: boolean;
  activePanel: GameMenuAction | null;
  onMenuSelect: (action: GameMenuAction) => void;
  emptyMessage?: string;
  screenPhase: GameScreenPhase;
  selectedPrediction: PredictionOption | null;
  /** 라운드 확정 결과 큰 글씨 (result_flash) — 실황 타격 결과 문구 우선 */
  roundResultLabel?: string | null;
  labelsVisible: boolean;
  labelsInteractive: boolean;
  blinkPrediction: PredictionOption | null;
  onFieldSelect: (option: PredictionOption) => void;
  showBetModal: boolean;
  selectedBetAmount: BetAmountOption;
  onBetAmountChange: (amount: BetAmountOption) => void;
  onBetModalCancel: () => void;
  onBetSubmit: () => void;
  onRunComplete: () => void;
  lastWonAmount: number;
  lastBetAmount: number;
  resultCountdown: number | null;
  eventCountdown?: number | null;
  eventSubtitle?: string;
  showAdOverlay?: boolean;
  adOverlayMessage?: string;
  adOverlayDismissible?: boolean;
  adOverlayCompleteAfterSeconds?: number;
  adSessionState?: AdSessionState;
  isNativePlatform?: boolean;
  onAdOverlayDismiss?: () => void;
  onAdOverlayComplete?: () => void;
  onMatchTitleClick?: () => void;
  onStadiumNameClick?: () => void;
  matchSelectEnabled?: boolean;
  stadiumSelectEnabled?: boolean;
  inningHalf?: "top" | "bottom";
  gameDayPhase?: GameDayPhase;
  gameDayOverlayKind?: GameDayOverlayKind | null;
  onGameTerminalComplete?: () => void;
  pregameCountdown?: PregameCountdownDisplay | null;
  sideBetSummary?: SideBetBottomSummary | null;
  onSideBetWinnerClick?: () => void;
  onSideBetScoreClick?: () => void;
  onAwayTeamClick?: () => void;
  onHomeTeamClick?: () => void;
  onPitcherClick?: (pitcher: LivePitcherSummary) => void;
  /** 경기/경기장 선택 모달 등 — 진행 위젯 숨김 */
  noticeSuppressed?: boolean;
  friendRoomName?: string | null;
  onFriendRoomClick?: () => void;
  /** 종료 오버레이 안내 문구 (기본: 홈으로) */
  terminalRedirectLabel?: string;
}

export default function LandscapeGameShell({
  matchTitle,
  stadiumName,
  headToHead = null,
  currentBatter = null,
  scoreboard,
  scoreLoading,
  matchesInitialLoading = false,
  activePanel,
  onMenuSelect,
  emptyMessage,
  screenPhase,
  selectedPrediction,
  roundResultLabel = null,
  labelsVisible,
  labelsInteractive,
  blinkPrediction,
  onFieldSelect,
  showBetModal,
  selectedBetAmount,
  onBetAmountChange,
  onBetModalCancel,
  onBetSubmit,
  onRunComplete,
  lastWonAmount,
  lastBetAmount,
  resultCountdown,
  eventCountdown,
  eventSubtitle,
  showAdOverlay,
  adOverlayMessage,
  adOverlayDismissible = true,
  adOverlayCompleteAfterSeconds,
  adSessionState,
  isNativePlatform,
  onAdOverlayDismiss,
  onAdOverlayComplete,
  onMatchTitleClick,
  onStadiumNameClick,
  matchSelectEnabled,
  stadiumSelectEnabled,
  inningHalf,
  gameDayPhase = "live",
  gameDayOverlayKind = null,
  onGameTerminalComplete,
  pregameCountdown = null,
  sideBetSummary = null,
  onSideBetWinnerClick,
  onSideBetScoreClick,
  onAwayTeamClick,
  onHomeTeamClick,
  onPitcherClick,
  noticeSuppressed = false,
  friendRoomName = null,
  onFriendRoomClick,
  terminalRedirectLabel,
}: LandscapeGameShellProps) {
  const { isGuest } = useUser();
  const { showGuestPopup, setShowGuestPopup } = useGuestRestriction(isGuest);

  const displayPitches = useAtBatPitchDisplay(scoreboard, screenPhase);
  const pitchLocationCount = displayPitches?.length ?? 0;
  const battingHalf =
    scoreboard?.inningHalf === "top" || scoreboard?.inningHalf === "bottom"
      ? scoreboard.inningHalf
      : inningHalf ?? null;
  const batsSide =
    scoreboard?.situation?.batsSide === "left" ||
    scoreboard?.situation?.batsSide === "right"
      ? scoreboard.situation.batsSide
      : currentBatter?.batsSide ?? null;
  const sceneKind = resolveGameSceneKind({
    gameDayPhase,
    screenPhase,
    inningHalf: battingHalf,
    batsSide,
  });
  const mirrorCinematic = shouldMirrorCinematic(sceneKind, batsSide);
  /** 대기·결과 큰 글씨·교체/광고 중에는 직전 타자 이름·시즌 카드를 남기지 않음 */
  const hideStaleBatter =
    screenPhase === "wait_start" ||
    screenPhase === "result_flash" ||
    isTransientAdOrEventPhase(screenPhase);
  const pitchCinematic = sceneKind === "pitch_home" || sceneKind === "pitch_away";
  /** 예측 중지·결과 큰 글씨에서 존 투구 점. 시네마틱 투구 사진은 전경 플레이트 좌표. */
  const strikeZoneVisible =
    pitchLocationCount > 0 &&
    !noticeSuppressed &&
    !showBetModal &&
    gameDayPhase === "live" &&
    (screenPhase === "wait_result" || screenPhase === "result_flash");

  return (
    <div
      className="fixed inset-0 w-[100dvw] h-[100dvh] overflow-hidden bg-black"
      data-testid="landscape-game-shell"
      data-bats-side={batsSide ?? "right"}
      data-scene={sceneKind}
      data-mirror={mirrorCinematic ? "x" : undefined}
    >
      <GameFieldViewport sceneKind={sceneKind} mirrorX={mirrorCinematic}>
        <GameLiveSituationWidget
          scoreboard={scoreboard}
          hidden={noticeSuppressed}
          hideBatterIdentity={hideStaleBatter}
          awayFallback={headToHead?.awayName}
          homeFallback={headToHead?.homeName}
          onAwayTeamClick={onAwayTeamClick}
          onHomeTeamClick={onHomeTeamClick}
          onPitcherClick={onPitcherClick}
        />
        {emptyMessage ? (
          <div className="absolute inset-0 flex items-center justify-center z-10 px-6">
            <p className="text-white text-center text-sm drop-shadow-lg">{emptyMessage}</p>
          </div>
        ) : (
          <>
            <GameTopScorePanel
              matchTitle={matchTitle}
              stadiumName={stadiumName}
              currentBatter={currentBatter}
              scoreboard={scoreboard}
              isLoading={scoreLoading || matchesInitialLoading}
              battingHalf={battingHalf}
              onMatchTitleClick={onMatchTitleClick}
              matchSelectEnabled={matchSelectEnabled}
              stadiumSelectEnabled={stadiumSelectEnabled}
              onStadiumNameClick={onStadiumNameClick}
              hideBatterCard={hideStaleBatter}
              selectedPrediction={
                screenPhase === "wait_result" ? selectedPrediction : null
              }
            />

            {pregameCountdown ? (
              <GamePregameCountdown countdown={pregameCountdown} />
            ) : null}

            {gameDayOverlayKind && onGameTerminalComplete ? (
              <GameDayStatusOverlay
                kind={gameDayOverlayKind}
                onComplete={onGameTerminalComplete}
                redirectLabel={terminalRedirectLabel}
              />
            ) : null}

            <GameFieldLabels
              visible={labelsVisible}
              interactive={labelsInteractive}
              selectedPrediction={selectedPrediction}
              highlightPrediction={null}
              blinkPrediction={blinkPrediction}
              onSelect={onFieldSelect}
            />

            <GameDefenseLayer visible={false} inningHalf={inningHalf} />

            <GameCharacterLayer
              phase={screenPhase}
              gameDayPhase={gameDayPhase}
              gameDayOverlayKind={gameDayOverlayKind}
              sceneKind={sceneKind}
              selectedPrediction={selectedPrediction}
              battingHalf={battingHalf}
              batsSide={batsSide}
              isPinchHitter={Boolean(currentBatter?.isPinchHitter)}
              hideWaitBubble={false}
              onRunComplete={onRunComplete}
            />

            <GameStrikeZoneOverlay
              pitches={displayPitches}
              batsSide={batsSide}
              platePoint={maybeMirrorImagePointX(
                sceneKind === "pitch_away"
                  ? PITCH_AWAY_PLATE_IMAGE
                  : sceneKind === "pitch_home"
                    ? PITCH_HOME_PLATE_IMAGE
                    : HOME_PLATE_IMAGE,
                mirrorCinematic,
              )}
              imageSize={pitchCinematic ? CINEMATIC_SCENE_IMAGE : undefined}
              cinematic={pitchCinematic}
              hidden={!strikeZoneVisible}
            />

            {screenPhase === "result_flash" && roundResultLabel ? (
              <GameRoundResultFlash result={roundResultLabel} />
            ) : null}

            <GameConfetti active={false} />

            {/* 레거시 성공/실패 배너 — 단계표상 미사용(큰 글씨→주루/대기). 안전망만 유지 */}
            {(screenPhase === "success_announce" || screenPhase === "fail") && (
              <GameResultBanner
                phase={screenPhase === "fail" ? "fail" : "success_announce"}
                prediction={selectedPrediction}
                betAmount={lastBetAmount}
                wonAmount={lastWonAmount}
                countdown={screenPhase === "fail" ? resultCountdown : null}
              />
            )}

            {screenPhase === "pitcher_change_event" && (
              <GameEventOverlay
                type="pitcher_change"
                countdown={eventCountdown}
              />
            )}

            {screenPhase === "inning_switch_event" && (
              <GameEventOverlay
                type="switch_half"
                subtitle={eventSubtitle}
                countdown={eventCountdown}
              />
            )}

            {screenPhase === "match_ended" && (
              <div
                className="absolute inset-0 z-[50] flex items-center justify-center pointer-events-none"
                data-testid="overlay-match-ended"
              >
                <div className="absolute inset-0 bg-black/65" />
                <p className="relative text-white text-[clamp(2rem,8vw,4.5rem)] font-black tracking-tight drop-shadow-lg">
                  경기종료
                </p>
              </div>
            )}
          </>
        )}
      </GameFieldViewport>

      <GameBottomStatusBar
        sideBetSummary={sideBetSummary}
        headToHead={headToHead}
        onWinnerClick={onSideBetWinnerClick}
        onScoreClick={onSideBetScoreClick}
        friendRoomName={friendRoomName}
        onFriendRoomClick={onFriendRoomClick}
      />

      <GameLeftMenu activePanel={activePanel} onSelect={onMenuSelect} />

      {(showAdOverlay ||
        (isNativePlatform && adSessionState === "preparing")) && (
        <GameAdOverlay
          message={
            adOverlayMessage ??
            (isNativePlatform && adSessionState === "preparing"
              ? "리워드 광고 준비 중입니다..."
              : "광고가 재생 중입니다...")
          }
          completeAfterSeconds={
            adOverlayCompleteAfterSeconds ?? Math.round(AD_PLAY_MS / 1000)
          }
          onComplete={onAdOverlayComplete}
          onDismiss={
            adOverlayDismissible && adSessionState !== "preparing"
              ? onAdOverlayDismiss
              : undefined
          }
        />
      )}

      {showBetModal && selectedPrediction && (
        <GameBetModal
          open={showBetModal}
          prediction={selectedPrediction}
          betAmount={selectedBetAmount}
          onBetAmountChange={onBetAmountChange}
          onCancel={onBetModalCancel}
          onSubmit={onBetSubmit}
        />
      )}

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />
    </div>
  );
}
