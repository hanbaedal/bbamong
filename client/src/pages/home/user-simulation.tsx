import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BetAmountSelector from "@/components/BetAmountSelector";
import {
  DEFAULT_BET_AMOUNT,
  PREDICTION_ODDS,
  calculateFixedOddsPayout,
  type BetAmountOption,
  type PredictionResult,
} from "@shared/predictionOdds";
import { useToast } from "@/hooks/use-toast";

type Phase = "pick" | "waiting" | "result";

const OPTIONS = Object.keys(PREDICTION_ODDS) as PredictionResult[];

export default function UserSimulationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [practicePoints, setPracticePoints] = useState(3000);
  const [amount, setAmount] = useState<BetAmountOption>(DEFAULT_BET_AMOUNT);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [actualResult, setActualResult] = useState<PredictionResult | null>(null);
  const [lastPayout, setLastPayout] = useState(0);
  const [round, setRound] = useState(1);
  const [log, setLog] = useState<string[]>([
    "연습 모드입니다. 실제 보유 포인트에는 영향이 없습니다.",
  ]);

  const expectedPayout = useMemo(() => {
    if (!prediction) return 0;
    return calculateFixedOddsPayout(amount, prediction);
  }, [amount, prediction]);

  const pushLog = (msg: string) => {
    setLog((prev) => [`R${round}: ${msg}`, ...prev].slice(0, 10));
  };

  const handleSubmit = () => {
    if (!prediction) {
      toast({ variant: "destructive", description: "예측을 선택해주세요." });
      return;
    }
    if (practicePoints < amount) {
      toast({ variant: "destructive", description: "연습 포인트가 부족합니다. 초기화하세요." });
      return;
    }
    setPracticePoints((p) => p - amount);
    setPhase("waiting");
    pushLog(`${prediction} / ${amount}P 배팅 (차감)`);
    toast({ description: "시뮬레이션: 예측이 접수되었습니다. 결과 발표를 눌러보세요." });
  };

  const handleReveal = () => {
    if (phase !== "waiting" || !prediction) return;
    const result = OPTIONS[Math.floor(Math.random() * OPTIONS.length)];
    setActualResult(result);
    const hit = result === prediction;
    const payout = hit ? calculateFixedOddsPayout(amount, result) : 0;
    setLastPayout(payout);
    if (hit) {
      setPracticePoints((p) => p + payout);
      pushLog(`결과 ${result} — 적중! +${payout}P`);
    } else {
      pushLog(`결과 ${result} — 미적중 (배팅 ${amount}P 소멸)`);
    }
    setPhase("result");
  };

  const handleNextRound = () => {
    setRound((r) => r + 1);
    setPrediction(null);
    setActualResult(null);
    setLastPayout(0);
    setPhase("pick");
    pushLog("다음 연습 라운드");
  };

  const handleReset = () => {
    setPracticePoints(3000);
    setAmount(DEFAULT_BET_AMOUNT);
    setPrediction(null);
    setActualResult(null);
    setLastPayout(0);
    setPhase("pick");
    setRound(1);
    setLog(["연습 모드 초기화 — 연습 포인트 3000P"]);
  };

  return (
    <div className="h-app-screen bg-[#111111] flex flex-col">
      <PageHeader
        title="게임 시뮬레이션"
        showSettings={false}
        leftAction={
          <button type="button" onClick={() => setLocation("/home")} className="p-1" data-testid="button-sim-back">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-scroll-touch px-5 pb-6 pt-4 space-y-4">
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
          연습 전용입니다. 서버 배팅·실제 포인트와 연결되지 않습니다.
        </div>

        <div className="rounded-lg border border-[#333] bg-[#1A1A1A] p-4 flex justify-between items-center">
          <div>
            <p className="text-[#888] text-xs">연습 포인트</p>
            <p className="text-[#CDFF00] text-xl font-bold">{practicePoints}P</p>
          </div>
          <div className="text-right">
            <p className="text-[#888] text-xs">라운드</p>
            <p className="text-white text-lg font-semibold">{round}</p>
          </div>
        </div>

        {phase === "pick" && (
          <>
            <BetAmountSelector
              value={amount}
              onChange={setAmount}
              selectedPrediction={prediction}
            />
            <h2 className="text-white text-sm font-bold">예측 선택</h2>
            <div className="space-y-2">
              {OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPrediction(opt)}
                  className={`w-full rounded-lg border p-3 flex justify-between items-center ${
                    prediction === opt
                      ? "border-[#CDFF00] bg-[#CDFF00]/10"
                      : "border-[#373539] bg-[#1A1A1A]"
                  }`}
                >
                  <span className="text-white text-sm font-medium">{opt}</span>
                  <span className="text-[#888] text-xs">{PREDICTION_ODDS[opt]}배</span>
                </button>
              ))}
            </div>
            {prediction && (
              <p className="text-[#AAAAAA] text-xs">
                적중 시 예상: {expectedPayout}P
              </p>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full py-3 bg-[#CDFF00] text-black font-bold rounded-lg"
              data-testid="button-sim-submit"
            >
              연습 배팅하기
            </button>
          </>
        )}

        {phase === "waiting" && (
          <div className="rounded-lg border border-[#333] bg-[#1A1A1A] p-5 text-center space-y-3">
            <p className="text-white font-semibold">결과 대기 중 (연습)</p>
            <p className="text-[#888] text-sm">
              선택: {prediction} · {amount}P
            </p>
            <button
              type="button"
              onClick={handleReveal}
              className="w-full py-3 bg-[#CDFF00] text-black font-bold rounded-lg"
              data-testid="button-sim-reveal"
            >
              결과 발표 (랜덤)
            </button>
          </div>
        )}

        {phase === "result" && actualResult && (
          <div className="rounded-lg border border-[#333] bg-[#1A1A1A] p-5 text-center space-y-3">
            <p className="text-[#888] text-sm">실제 결과(연습)</p>
            <p className="text-white text-2xl font-bold">{actualResult}</p>
            {prediction === actualResult ? (
              <p className="text-[#CDFF00] font-semibold">적중! +{lastPayout}P</p>
            ) : (
              <p className="text-red-400 font-semibold">미적중 (내 선택: {prediction})</p>
            )}
            <button
              type="button"
              onClick={handleNextRound}
              className="w-full py-3 bg-[#CDFF00] text-black font-bold rounded-lg"
            >
              다음 연습 라운드
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="w-full py-2 text-[#888] text-sm"
        >
          시뮬레이션 초기화
        </button>

        <div className="rounded-lg border border-[#333] bg-[#141414] p-3">
          <h3 className="text-white text-xs font-semibold mb-2">연습 로그</h3>
          <ul className="space-y-1">
            {log.map((line, i) => (
              <li key={`${i}-${line}`} className="text-[#888] text-[11px]">
                • {line}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => setLocation("/home/guide")}
          className="w-full py-3 border border-[#373539] text-white text-sm rounded-lg"
        >
          사용 설명서 보기
        </button>
      </div>
    </div>
  );
}
