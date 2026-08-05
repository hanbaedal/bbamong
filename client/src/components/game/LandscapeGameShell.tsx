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
import GameEventOverlay from "./GameEventOverlay";
import GameAdOverlay from "./GameAdOverlay";
import GameNoticeBanner from "./GameNoticeBanner";
import ConfirmPopup from "@/components/customUi/confirmPopup";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";
import { useUser } from "@/contexts/UserContext";
import type { AdSessionState } from "@/hooks/useAdMob";
import type { LiveScoreboard, CurrentBatterPreview } from "@shared/apiSportsTypes";
import type { GameDayPhase, GameTerminalKind } from "@/lib/gameDayPhase";
import type { PregameCountdownDisplay } from "./GamePregameCountdown";
import type { SideBetBottomSummary } from "./GameBottomStatusBar";
import type { GameScreenPhase, PredictionOption } from "./gameTypes";
import { calculateFixedOddsPayout, type BetAmountOption } from "@shared/predictionOdds";
import "./gameAnimations.css";

interface LandscapeGameShellProps {
  matchTitle: string;
  stadiumName: string;
  teamNamesLine?: string | null;
  headToHeadLine?: string | null;
  currentBatter?: CurrentBatterPreview | null;
  scoreboard: LiveScoreboard | null;
  scoreLoading?: boolean;
  matchesLoading?: boolean;
  activePanel: GameMenuAction | null;
  onMenuSelect: (action: GameMenuAction) => void;
  emptyMessage?: string;
  screenPhase: GameScreenPhase;
  selectedPrediction: PredictionOption | null;
  labelsVisible: boolean;
  labelsInteractive: boolean;
  blinkPrediction: PredictionOption | null;
  onFieldSelect: (option: PredictionOption) => void;
  showBetModal: boolean;
  selectedBetAmount: BetAmountOption;
  onBetAmountChange: (amount: BetAmountOption) => void;
  onBetModalCancel: () => void;
  onBetNext: () => void;
  showConfirmModal: boolean;
  onConfirmCancel: () => void;
  onConfirmSubmit: () => void;
  onRunComplete: () => void;
  lastWonAmount: number;
  lastBetAmount: number;
  resultCountdown: number | null;
  eventCountdown?: number | null;
  eventSubtitle?: string;
  showAdOverlay?: boolean;
  adSessionState?: AdSessionState;
  isNativePlatform?: boolean;
  onMatchTitleClick?: () => void;
  onStadiumNameClick?: () => void;
  matchSelectEnabled?: boolean;
  stadiumSelectEnabled?: boolean;
  inningHalf?: "top" | "bottom";
  gameDayPhase?: GameDayPhase;
  gameTerminalKind?: GameTerminalKind | null;
  onGameTerminalComplete?: () => void;
  pregameCountdown?: PregameCountdownDisplay | null;
  sideBetSummary?: SideBetBottomSummary | null;
  onSideBetWinnerClick?: () => void;
  onSideBetScoreClick?: () => void;
}

export default function LandscapeGameShell({
  matchTitle,
  stadiumName,
  teamNamesLine,
  headToHeadLine,
  currentBatter = null,
  scoreboard,
  scoreLoading,
  matchesLoading,
  activePanel,
  onMenuSelect,
  emptyMessage,
  screenPhase,
  selectedPrediction,
  labelsVisible,
  labelsInteractive,
  blinkPrediction,
  onFieldSelect,
  showBetModal,
  selectedBetAmount,
  onBetAmountChange,
  onBetModalCancel,
  onBetNext,
  showConfirmModal,
  onConfirmCancel,
  onConfirmSubmit,
  onRunComplete,
  lastWonAmount,
  lastBetAmount,
  resultCountdown,
  eventCountdown,
  eventSubtitle,
  showAdOverlay,
  adSessionState,
  isNativePlatform,
  onMatchTitleClick,
  onStadiumNameClick,
  matchSelectEnabled,
  stadiumSelectEnabled,
  inningHalf,
  gameDayPhase = "live",
  gameTerminalKind = null,
  onGameTerminalComplete,
  pregameCountdown = null,
  sideBetSummary = null,
  onSideBetWinnerClick,
  onSideBetScoreClick,
}: LandscapeGameShellProps) {
  const { isGuest } = useUser();
  const { showGuestPopup, setShowGuestPopup } = useGuestRestriction(isGuest);

  const confirmPayout =
    selectedPrediction != null
      ? calculateFixedOddsPayout(selectedBetAmount, selectedPrediction)
      : 0;

  return (
    <div
      className="fixed inset-0 w-[100dvw] h-[100dvh] overflow-hidden bg-black"
      data-testid="landscape-game-shell"
    >
      <GameFieldViewport>
        <GameNoticeBanner suppressed={false} />
        {matchesLoading ? (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-white text-sm drop-shadow-lg">경기 정보를 불러오는 중...</p>
          </div>
        ) : emptyMessage ? (
          <div className="absolute inset-0 flex items-center justify-center z-10 px-6">
            <p className="text-white text-center text-sm drop-shadow-lg">{emptyMessage}</p>
          </div>
        ) : (
          <>
            <GameTopScorePanel
              matchTitle={matchTitle}
              stadiumName={stadiumName}
              teamNamesLine={teamNamesLine}
              headToHeadLine={headToHeadLine}
              currentBatter={currentBatter}
              scoreboard={scoreboard}
              isLoading={scoreLoading}
              battingHalf={inningHalf ?? null}
              onMatchTitleClick={onMatchTitleClick}
              onStadiumNameClick={onStadiumNameClick}
              matchSelectEnabled={matchSelectEnabled}
              stadiumSelectEnabled={stadiumSelectEnabled}
            />

            {pregameCountdown ? (
              <GamePregameCountdown countdown={pregameCountdown} />
            ) : null}

            {gameTerminalKind && onGameTerminalComplete ? (
              <GameDayStatusOverlay kind={gameTerminalKind} onComplete={onGameTerminalComplete} />
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
              gameTerminalKind={gameTerminalKind}
              selectedPrediction={selectedPrediction}
              onRunComplete={onRunComplete}
            />

            <GameConfetti active={screenPhase === "success_celebrate"} />

            {(screenPhase === "success_celebrate" || screenPhase === "fail") && (
              <GameResultBanner
                phase={screenPhase}
                prediction={selectedPrediction}
                betAmount={lastBetAmount}
                wonAmount={lastWonAmount}
                countdown={resultCountdown}
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
          </>
        )}
      </GameFieldViewport>

      <GameBottomStatusBar
        sideBetSummary={sideBetSummary}
        onWinnerClick={onSideBetWinnerClick}
        onScoreClick={onSideBetScoreClick}
      />

      <GameLeftMenu activePanel={activePanel} onSelect={onMenuSelect} />

      {((showAdOverlay && !isNativePlatform) ||
        (isNativePlatform &&
          (adSessionState === "preparing" || adSessionState === "overlay"))) && (
        <GameAdOverlay
          message={
            isNativePlatform && adSessionState === "preparing"
              ? "광고 준비 중입니다..."
              : "광고가 재생 중입니다..."
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
          onNext={onBetNext}
        />
      )}

      {showConfirmModal && selectedPrediction && (
        <ConfirmPopup
          title="예측 확인"
          details={[
            { label: "예측", value: selectedPrediction },
            { label: "배팅", value: `${selectedBetAmount}P` },
          ]}
          footerLabel="적중 시 예상"
          footerValue={`${confirmPayout}P`}
          onCancel={onConfirmCancel}
          onConfirm={onConfirmSubmit}
        />
      )}

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />
    </div>
  );
}
