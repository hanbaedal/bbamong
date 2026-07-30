import GameFieldViewport from "./GameFieldViewport";
import GameLeftMenu, { type GameMenuAction } from "./GameLeftMenu";
import GameTopScorePanel from "./GameTopScorePanel";
import GameFieldLabels from "./GameFieldLabels";
import GameMenuPanel from "./GameMenuPanel";
import GameCharacterLayer from "./GameCharacterLayer";
import GameDefenseLayer from "./GameDefenseLayer";
import GameConfetti from "./GameConfetti";
import GameBottomStatusBar from "./GameBottomStatusBar";
import GameBetModal from "./GameBetModal";
import GameResultBanner from "./GameResultBanner";
import GameEventOverlay from "./GameEventOverlay";
import GameAdOverlay from "./GameAdOverlay";
import ConfirmPopup from "@/components/customUi/confirmPopup";
import type { AdSessionState } from "@/hooks/useAdMob";
import type { LiveScoreboard } from "@shared/apiSportsTypes";
import type { GameScreenPhase, PredictionOption } from "./gameTypes";
import { calculateFixedOddsPayout, type BetAmountOption } from "@shared/predictionOdds";
import "./gameAnimations.css";

interface LandscapeGameShellProps {
  matchTitle: string;
  stadiumName: string;
  batterText: string;
  scoreboard: LiveScoreboard | null;
  scoreLoading?: boolean;
  matchesLoading?: boolean;
  activePanel: GameMenuAction | null;
  onMenuSelect: (action: GameMenuAction) => void;
  onClosePanel: () => void;
  todayStats?: { total: number; wins: number };
  statsLoading?: boolean;
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
}

export default function LandscapeGameShell({
  matchTitle,
  stadiumName,
  batterText,
  scoreboard,
  scoreLoading,
  matchesLoading,
  activePanel,
  onMenuSelect,
  onClosePanel,
  todayStats,
  statsLoading,
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
}: LandscapeGameShellProps) {
  const storyLinks = [
    { label: "승리현황", href: "/victory-history", testId: "link-victory-history" },
    { label: "공지사항", href: "/notice", testId: "link-notice" },
    { label: "나의 콘텐츠", href: "/ebook", testId: "link-ebook" },
    { label: "사회공헌 참여현황", href: "/donation-history", testId: "link-donation" },
  ];

  const infoLinks = [
    { label: "회원정보", href: "/profile", testId: "link-profile" },
    { label: "서비스 이용약관", href: "/terms", testId: "link-terms" },
    { label: "고객센터", href: "/customer-center", testId: "link-customer-center" },
  ];

  const confirmPayout =
    selectedPrediction != null
      ? calculateFixedOddsPayout(selectedBetAmount, selectedPrediction)
      : 0;

  return (
    <div
      className="fixed inset-0 w-[100dvw] h-[100dvh] overflow-hidden bg-black flex flex-row"
      data-testid="landscape-game-shell"
    >
      <GameLeftMenu activePanel={activePanel} onSelect={onMenuSelect} />

      <GameFieldViewport>
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
              batterText={batterText}
              scoreboard={scoreboard}
              isLoading={scoreLoading}
              battingHalf={inningHalf ?? null}
              onMatchTitleClick={onMatchTitleClick}
              onStadiumNameClick={onStadiumNameClick}
              matchSelectEnabled={matchSelectEnabled}
              stadiumSelectEnabled={stadiumSelectEnabled}
            />

            <GameFieldLabels
              visible={labelsVisible}
              interactive={labelsInteractive}
              selectedPrediction={selectedPrediction}
              highlightPrediction={null}
              blinkPrediction={blinkPrediction}
              onSelect={onFieldSelect}
            />

            <GameDefenseLayer
              visible={screenPhase === "picking"}
              inningHalf={inningHalf}
            />

            <GameCharacterLayer
              phase={screenPhase}
              selectedPrediction={selectedPrediction}
              onRunComplete={onRunComplete}
            />

            <GameConfetti active={screenPhase === "success_celebrate"} />

            <GameBottomStatusBar />

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

      <GameMenuPanel
        panel={activePanel === "story" || activePanel === "info" ? activePanel : null}
        onClose={onClosePanel}
        storyLinks={storyLinks}
        infoLinks={infoLinks}
        todayStats={todayStats}
        statsLoading={statsLoading}
      />

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
    </div>
  );
}
