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
  homeTeamName: string | null;
  awayTeamName: string | null;
  bets: SideBetRecord[];
}

export interface SideBetActionPanelProps {
  matchId: string;
  matchTitle: string;
  betType: "winner" | "score";
  onCancel: () => void;
  onSubmitted?: () => void;
}

/** 가로 분할 모달 오른쪽 — 우승팀/점수 입력 */
export default function SideBetActionPanel({
  matchId,
  matchTitle,
  betType,
  onCancel,
  onSubmitted,
}: SideBetActionPanelProps) {
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
    enabled: Boolean(matchId),
  });

  const locked = data?.sideBetsLocked ?? false;
  const homeName = data?.homeTeamName?.trim() || "홈팀";
  const awayName = data?.awayTeamName?.trim() || "원정팀";
  const existingBet = data?.bets.find((b) => b.type === betType);
  const isEdit = Boolean(existingBet && existingBet.status === "pending" && !locked);
  const formDisabled = locked || isLoading || submitting || (Boolean(existingBet) && !isEdit);

  useEffect(() => {
    setWinnerPick(null);
    setHomeScore("");
    setAwayScore("");
    setAmount(DEFAULT_SIDE_BET_AMOUNT);
  }, [matchId, betType]);

  useEffect(() => {
    if (existingBet?.type === "winner" && existingBet.winnerPick) {
      setWinnerPick(existingBet.winnerPick);
    }
    if (existingBet?.type === "score") {
      if (existingBet.homeScorePick != null) setHomeScore(String(existingBet.homeScorePick));
      if (existingBet.awayScorePick != null) setAwayScore(String(existingBet.awayScorePick));
    }
    if (existingBet?.amount) {
      setAmount(existingBet.amount as SideBetAmountOption);
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
        amount: existingBet?.amount ?? amount,
        winnerPick: pick,
      });
      toast({ description: isEdit ? "우승팀 예측이 수정되었습니다." : "승리팀 배팅이 접수되었습니다." });
      invalidate();
      onSubmitted?.();
      onCancel();
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
      toast({ variant: "destructive", description: "원정·홈 점수를 입력해주세요." });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/live-match/side-bets", {
        matchId,
        type: "score",
        amount: existingBet?.amount ?? amount,
        homeScorePick: home,
        awayScorePick: away,
      });
      toast({ description: isEdit ? "점수 예측이 수정되었습니다." : "최종 스코어 배팅이 접수되었습니다." });
      invalidate();
      onSubmitted?.();
      onCancel();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "배팅 접수에 실패했습니다.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const title = betType === "winner" ? "우승팀 맞추기" : "점수 맞추기";
  const oddsLabel = betType === "winner" ? `${WINNER_ODDS}배` : `${EXACT_SCORE_ODDS}배`;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="side-bet-action-panel">
      <div className="shrink-0 border-b border-[#333] px-3 py-2.5">
        <h3 className="text-center text-base font-bold text-white">{title}</h3>
        <p className="mt-0.5 text-center text-[11px] text-[#AAA]">
          {matchTitle} · {oddsLabel}
        </p>
        {locked && (
          <p className="mt-1 text-center text-[11px] text-amber-400">1회 시작으로 배팅이 마감되었습니다.</p>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {existingBet && (
          <p className="text-center text-[11px] text-[#CDFF00]">
            {isEdit ? "수정 가능 · " : "이미 배팅함 · "}
            {existingBet.type === "winner"
              ? `${existingBet.winnerPick === "home" ? homeName : awayName} · ${existingBet.amount}P`
              : `원정 ${existingBet.awayScorePick} : 홈 ${existingBet.homeScorePick} · ${existingBet.amount}P`}
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
              <button
                type="button"
                disabled={formDisabled}
                onClick={() => setWinnerPick("away")}
                className={`rounded-lg border px-2 py-3 text-sm font-semibold ${
                  winnerPick === "away"
                    ? "border-[#CDFF00] bg-[#CDFF00]/10 text-[#CDFF00]"
                    : "border-[#373539] text-white"
                } ${formDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span className="block text-[10px] font-normal text-[#888]">원정</span>
                {awayName}
              </button>
              <button
                type="button"
                disabled={formDisabled}
                onClick={() => setWinnerPick("home")}
                className={`rounded-lg border px-2 py-3 text-sm font-semibold ${
                  winnerPick === "home"
                    ? "border-[#CDFF00] bg-[#CDFF00]/10 text-[#CDFF00]"
                    : "border-[#373539] text-white"
                } ${formDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span className="block text-[10px] font-normal text-[#888]">홈</span>
                {homeName}
              </button>
            </div>
            {!locked && !existingBet && winnerPick && (
              <p className="text-center text-[11px] text-[#888]">
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
            <div className="flex items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-center text-[10px] text-[#888]">원정 · {awayName}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  max={30}
                  value={awayScore}
                  disabled={formDisabled}
                  onChange={(e) => setAwayScore(e.target.value)}
                  placeholder="0"
                  className="h-9 w-full rounded-md border border-[#373539] bg-[#141414] text-center text-sm text-white disabled:opacity-50"
                />
              </label>
              <span className="pb-2 text-sm text-[#888]">:</span>
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-center text-[10px] text-[#888]">홈 · {homeName}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  max={30}
                  value={homeScore}
                  disabled={formDisabled}
                  onChange={(e) => setHomeScore(e.target.value)}
                  placeholder="0"
                  className="h-9 w-full rounded-md border border-[#373539] bg-[#141414] text-center text-sm text-white disabled:opacity-50"
                />
              </label>
            </div>
            {!locked && !existingBet && homeScore !== "" && awayScore !== "" && (
              <p className="text-center text-[11px] text-[#888]">
                적중 시 {calculateSideBetPayout(amount, "score")}P
              </p>
            )}
          </>
        )}
      </div>

      <div className="shrink-0 flex gap-2 border-t border-[#333] px-3 py-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 flex-1 rounded-lg bg-[#474747] text-sm font-medium text-white"
        >
          취소
        </button>
        {!locked && (!existingBet || isEdit) && (
          <button
            type="button"
            disabled={
              formDisabled ||
              (betType === "winner" ? !winnerPick : homeScore === "" || awayScore === "")
            }
            onClick={() => void (betType === "winner" ? submitWinner() : submitScore())}
            className="h-10 flex-1 rounded-lg bg-[#CDFF00] text-sm font-bold text-black disabled:opacity-50"
            data-testid={betType === "winner" ? "button-side-bet-winner" : "button-side-bet-score"}
          >
            {submitting ? "처리 중..." : isEdit ? "수정하기" : "배팅하기"}
          </button>
        )}
      </div>
    </div>
  );
}
