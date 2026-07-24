import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type SimPhase =
  | "idle"
  | "predicting"
  | "stopped"
  | "result_done"
  | "ad_playing";

type ResultOption = "아웃" | "1루" | "2루" | "3루" | "홈런";

const RESULTS: ResultOption[] = ["아웃", "1루", "2루", "3루", "홈런"];
const ODDS: Record<ResultOption, number> = {
  아웃: 1.2,
  "1루": 1.5,
  "2루": 3,
  "3루": 10,
  홈런: 5,
};

export default function ManagerSimulationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [phase, setPhase] = useState<SimPhase>("idle");
  const [round, setRound] = useState(1);
  const [inning, setInning] = useState(1);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [selectedResult, setSelectedResult] = useState<ResultOption | null>(null);
  const [log, setLog] = useState<string[]>([
    "연습 모드입니다. 서버·유저 데이터에 반영되지 않습니다.",
  ]);

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case "idle":
        return "대기 (예측 시작 전)";
      case "predicting":
        return "예측 진행 중";
      case "stopped":
        return "예측 중지됨 (결과 입력 가능)";
      case "result_done":
        return "결과 반영됨";
      case "ad_playing":
        return "광고 재생 중 (연습)";
      default:
        return phase;
    }
  }, [phase]);

  const pushLog = (message: string) => {
    setLog((prev) => [`R${round}: ${message}`, ...prev].slice(0, 12));
  };

  const handleStart = () => {
    if (phase === "predicting" || phase === "ad_playing") {
      toast({ variant: "destructive", description: "지금 단계에서는 시작할 수 없습니다." });
      return;
    }
    setPhase("predicting");
    setSelectedResult(null);
    pushLog("예측 시작 — 회원 배팅 가능(가상)");
    toast({ description: "시뮬레이션: 예측이 시작되었습니다." });
  };

  const handleStop = () => {
    if (phase !== "predicting") {
      toast({ variant: "destructive", description: "예측 진행 중에만 중지할 수 있습니다." });
      return;
    }
    setPhase("stopped");
    pushLog("예측 중지 — 배팅 마감(가상)");
    toast({ description: "시뮬레이션: 예측이 중지되었습니다." });
  };

  const handleResult = () => {
    if (phase !== "stopped" || !selectedResult) {
      toast({
        variant: "destructive",
        description: "예측을 중지한 뒤 결과를 선택하세요.",
      });
      return;
    }
    const payoutExample = Math.floor(100 * ODDS[selectedResult]);
    setPhase("result_done");
    pushLog(
      `결과 ${selectedResult} 전송 — 적중 시 예: 100P × ${ODDS[selectedResult]} = ${payoutExample}P`,
    );
    toast({ description: `시뮬레이션: 결과 ${selectedResult} 반영` });

    // 다음 라운드 자동 준비
    setTimeout(() => {
      setRound((r) => r + 1);
      setSelectedResult(null);
      setPhase("idle");
      pushLog("다음 라운드로 이동(가상)");
    }, 600);
  };

  const handleSideChange = () => {
    if (phase === "predicting") {
      setPhase("stopped");
      pushLog("공수교대로 예측 자동 중지(가상)");
    }
    setInning((v) => v + 1);
    setAwayScore((v) => v);
    setHomeScore((v) => v);
    setPhase("ad_playing");
    pushLog("공수교대 — 전면/보상 광고 시작(가상)");
    toast({ description: "시뮬레이션: 공수교대 광고 시작" });
  };

  const handleAdStop = () => {
    if (phase !== "ad_playing") return;
    setPhase("idle");
    pushLog("광고 중지 — 경기 재개 대기(가상)");
    toast({ description: "시뮬레이션: 광고 중지" });
  };

  const handleScoreBump = (side: "home" | "away") => {
    if (side === "home") setHomeScore((v) => v + 1);
    else setAwayScore((v) => v + 1);
    pushLog(`${side === "home" ? "홈" : "원정"} 득점 +1 (가상 스코어)`);
  };

  const handleReset = () => {
    setPhase("idle");
    setRound(1);
    setInning(1);
    setHomeScore(0);
    setAwayScore(0);
    setSelectedResult(null);
    setLog(["연습 모드 초기화되었습니다."]);
  };

  return (
    <div
      className="h-[100dvh] bg-white flex flex-col overflow-hidden"
      style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 44px)" }}
    >
      <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <button
          type="button"
          onClick={() => setLocation("/manager/home")}
          className="text-gray-700 min-h-[44px] px-2"
          data-testid="button-sim-back"
        >
          ← 홈
        </button>
        <h1 className="text-[17px] font-semibold text-gray-900">시뮬레이션</h1>
        <button
          type="button"
          onClick={() => setLocation("/manager/guide")}
          className="text-[#1A6DFF] text-sm min-h-[44px] px-2"
        >
          설명
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 pb-8 space-y-3">
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[13px] text-amber-900">
          연습 전용입니다. 실제 경기·유저 포인트·API와 연결되지 않습니다.
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold text-gray-900">가상 스코어보드</span>
            <span className="text-gray-600">{inning}회 · R{round}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
            <div>
              <p className="text-xs text-gray-500">원정</p>
              <p className="text-2xl font-bold">{awayScore}</p>
            </div>
            <div className="text-gray-400">:</div>
            <div>
              <p className="text-xs text-gray-500">홈</p>
              <p className="text-2xl font-bold">{homeScore}</p>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleScoreBump("away")}>
              원정 +1
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => handleScoreBump("home")}>
              홈 +1
            </Button>
          </div>
          <p className="mt-2 text-[13px] text-[#1A6DFF] font-medium">상태: {phaseLabel}</p>
        </div>

        <div className="space-y-2">
          <h2 className="text-[15px] font-semibold text-gray-900">타석 제어 (연습)</h2>
          <Button
            className="w-full min-h-[48px] bg-[#1A6DFF] hover:bg-[#1558d6]"
            onClick={handleStart}
            disabled={phase === "predicting" || phase === "ad_playing"}
            data-testid="button-sim-start"
          >
            예측 시작
          </Button>
          <Button
            variant="outline"
            className="w-full min-h-[48px] border-orange-400 text-orange-600"
            onClick={handleStop}
            disabled={phase !== "predicting"}
            data-testid="button-sim-stop"
          >
            예측 중지
          </Button>

          <div className="grid grid-cols-5 gap-1.5">
            {RESULTS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedResult(r)}
                disabled={phase !== "stopped"}
                className={`min-h-[44px] rounded-md text-sm font-semibold border ${
                  selectedResult === r
                    ? "bg-[#1A6DFF] text-white border-[#1A6DFF]"
                    : "bg-white text-gray-800 border-gray-200"
                } disabled:opacity-40`}
              >
                {r}
              </button>
            ))}
          </div>
          <Button
            className="w-full min-h-[48px] bg-black text-white"
            onClick={handleResult}
            disabled={phase !== "stopped" || !selectedResult}
            data-testid="button-sim-result"
          >
            결과 전송
          </Button>
        </div>

        <div className="space-y-2">
          <h2 className="text-[15px] font-semibold text-gray-900">공수교대·광고 (연습)</h2>
          <Button
            variant="outline"
            className="w-full min-h-[48px]"
            onClick={handleSideChange}
            disabled={phase === "ad_playing"}
            data-testid="button-sim-side-change"
          >
            공수 교대 → 광고 시작
          </Button>
          <Button
            variant="outline"
            className="w-full min-h-[48px] border-red-400 text-red-600"
            onClick={handleAdStop}
            disabled={phase !== "ad_playing"}
            data-testid="button-sim-ad-stop"
          >
            광고 중지
          </Button>
        </div>

        <Button variant="ghost" className="w-full" onClick={handleReset}>
          시뮬레이션 초기화
        </Button>

        <div className="rounded-lg border border-gray-200 p-3">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">연습 로그</h3>
          <ul className="space-y-1.5">
            {log.map((line, idx) => (
              <li key={`${idx}-${line}`} className="text-[12px] text-gray-600 leading-snug">
                • {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
