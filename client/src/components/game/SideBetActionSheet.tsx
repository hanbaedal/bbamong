import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import SideBetAmountSelector from "@/components/SideBetAmountSelector";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_SIDE_BET_AMOUNT,
  calculateSideBetPayout,
  WINNER_ODDS,
  EXACT_SCORE_ODDS,
  type SideBetAmountOption,
  type WinnerSide,
} from "@shared/predictionOdds";

interface SideBetRecord {
  id: number;
  type: "winner" | "score";
  winnerPick: WinnerSide | null;
  homeScorePick: number | null;
  awayScorePick: number | null;
  amount: number;
  status: string;
}

interface SideBetsMeResponse {
  sideBetsLocked: boolean;
  bets: SideBetRecord[];
}

interface SideBetActionSheetProps {
  open: boolean;
  matchId: string;
  matchTitle: string;
  betType: "winner" | "score";
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function SideBetActionSheet({
  open,
  matchId,
  matchTitle,
  betType,
  onClose,
  onSubmitted,
}: SideBetActionSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState<SideBetAmountOption>(DEFAULT_SIDE_BET_AMOUNT);
  const [winnerPick, setWinnerPick] = useState<WinnerSide | null>(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery<SideBetsMeResponse>({
    queryKey: ["/api/live-match/matches", matchId, "side-bets/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/live-match/matches/${matchId}/side-bets/me`);
      return res.json();
    },
    enabled: open && Boolean(matchId),
  });

  const locked = data?.sideBetsLocked ?? false;
  const existingBet = data?.bets.find((b) => b.type === betType);
  const formDisabled = locked || isLoading || submitting || Boolean(existingBet);

  useEffect(() => {
    if (!open) return;
    setWinnerPick(null);
    setHomeScore("");
    setAwayScore("");
    setAmount(DEFAULT_SIDE_BET_AMOUNT);
  }, [open, matchId, betType]);

  useEffect(() => {
    if (existingBet?.type === "winner" && existingBet.winnerPick) {
      setWinnerPick(existingBet.winnerPick);
    }
    if (existingBet?.type === "score") {
      if (existingBet.homeScorePick != null) setHomeScore(String(existingBet.homeScorePick));
      if (existingBet.awayScorePick != null) setAwayScore(String(existingBet.awayScorePick));
    }
  }, [existingBet]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/live-match/matches", matchId, "side-bets/me"] });
    queryClient.invalidateQueries({ queryKey: ["/api/live-match/side-bets/me/today"] });
  };

  const submitWinner = async () => {
    const pick = winnerPick ?? existingBet?.winnerPick ?? null;
    if (!pick) {
      toast({ variant: "destructive", description: "승리팀을 선택해주세요." });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/live-match/side-bets", {
        matchId,
        type: "winner",
        amount,
        winnerPick: pick,
      });
      toast({ description: "승리팀 배팅이 접수되었습니다." });
      invalidate();
      onSubmitted?.();
      onClose();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "배팅 접수에 실패했습니다.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitScore = async () => {
    const home = parseInt(homeScore, 10);
    const away = parseInt(awayScore, 10);
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
      toast({ variant: "destructive", description: "홈·원정 점수를 입력해주세요." });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/live-match/side-bets", {
        matchId,
        type: "score",
        amount,
        homeScorePick: home,
        awayScorePick: away,
      });
      toast({ description: "최종 스코어 배팅이 접수되었습니다." });
      invalidate();
      onSubmitted?.();
      onClose();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "배팅 접수에 실패했습니다.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const title = betType === "winner" ? "우승팀 맞추기" : "점수 맞추기";
  const oddsLabel = betType === "winner" ? `${WINNER_ODDS}배` : `${EXACT_SCORE_ODDS}배`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      data-testid="side-bet-action-sheet"
    >
      <div
        className="w-[min(380px,94vw)] max-h-[min(480px,85dvh)] flex flex-col bg-[#1E1E1E] border border-[#444] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-[#333]">
          <h3 className="text-white text-lg font-bold text-center">{title}</h3>
          <p className="text-[#AAA] text-xs text-center mt-1">
            {matchTitle} · {oddsLabel} · 100P 단위
          </p>
          {locked && (
            <p className="text-amber-400 text-xs text-center mt-2">1회 시작으로 배팅이 마감되었습니다.</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {existingBet && (
            <p className="text-[#CDFF00] text-xs text-center">
              이미 배팅함 ·{" "}
              {existingBet.type === "winner"
                ? `${existingBet.winnerPick === "home" ? "홈팀" : "원정팀"} · ${existingBet.amount}P`
                : `${existingBet.homeScorePick}-${existingBet.awayScorePick} · ${existingBet.amount}P`}
              {existingBet.status !== "pending" && ` · ${existingBet.status}`}
            </p>
          )}

          {betType === "winner" ? (
            <>
              {!existingBet && (
                <SideBetAmountSelector
                  value={amount}
                  onChange={setAmount}
                  betType="winner"
                  disabled={formDisabled}
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                {(["home", "away"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    disabled={formDisabled}
                    onClick={() => setWinnerPick(side)}
                    className={`rounded-lg border p-3 text-sm font-medium ${
                      winnerPick === side || existingBet?.winnerPick === side
                        ? "border-[#CDFF00] bg-[#CDFF00]/10 text-[#CDFF00]"
                        : "border-[#373539] text-white"
                    } ${formDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {side === "home" ? "홈팀" : "원정팀"}
                  </button>
                ))}
              </div>
              {!locked && !existingBet && winnerPick && (
                <p className="text-[#888] text-xs text-center">
                  적중 시 {calculateSideBetPayout(amount, "winner")}P
                </p>
              )}
            </>
          ) : (
            <>
              {!existingBet && (
                <SideBetAmountSelector
                  value={amount}
                  onChange={setAmount}
                  betType="score"
                  disabled={formDisabled}
                />
              )}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={homeScore}
                  disabled={formDisabled}
                  onChange={(e) => setHomeScore(e.target.value)}
                  placeholder="홈"
                  className="flex-1 h-11 rounded-lg border border-[#373539] bg-[#141414] text-white text-center text-sm disabled:opacity-50"
                />
                <span className="text-[#888]">:</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={awayScore}
                  disabled={formDisabled}
                  onChange={(e) => setAwayScore(e.target.value)}
                  placeholder="원정"
                  className="flex-1 h-11 rounded-lg border border-[#373539] bg-[#141414] text-white text-center text-sm disabled:opacity-50"
                />
              </div>
              {!locked && !existingBet && homeScore !== "" && awayScore !== "" && (
                <p className="text-[#888] text-xs text-center">
                  적중 시 {calculateSideBetPayout(amount, "score")}P
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-[#333] flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-lg bg-[#474747] text-white font-medium"
          >
            닫기
          </button>
          {!existingBet && !locked && (
            <button
              type="button"
              disabled={
                formDisabled ||
                (betType === "winner" ? !winnerPick : homeScore === "" || awayScore === "")
              }
              onClick={() => void (betType === "winner" ? submitWinner() : submitScore())}
              className="flex-1 h-11 rounded-lg bg-[#CDFF00] text-black font-bold disabled:opacity-50"
              data-testid={betType === "winner" ? "button-side-bet-winner" : "button-side-bet-score"}
            >
              {submitting ? "접수 중..." : "배팅하기"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
