import type { PredictionOption } from "./gameTypes";

interface GameResultBannerProps {
  phase: "success_celebrate" | "fail";
  prediction?: PredictionOption | null;
  betAmount?: number;
  wonAmount?: number;
  countdown?: number | null;
}

export default function GameResultBanner({
  phase,
  prediction,
  betAmount = 0,
  wonAmount = 0,
  countdown,
}: GameResultBannerProps) {
  const isSuccess = phase === "success_celebrate";

  return (
    <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 z-[35] pointer-events-none">
      <div
        className={`px-6 py-3 rounded-xl shadow-xl text-center ${
          isSuccess ? "bg-[#1A3D1A]/90 border border-[#39FF14]" : "bg-[#3D1A1A]/90 border border-[#FF4444]"
        }`}
        data-testid={isSuccess ? "banner-success" : "banner-fail"}
      >
        <p className={`text-lg sm:text-xl font-bold ${isSuccess ? "text-[#39FF14]" : "text-[#FF6666]"}`}>
          {isSuccess ? "예측 성공!" : "예측 실패"}
        </p>
        {prediction && (
          <p className="text-white/90 text-sm mt-1">
            예측 {prediction} · 배팅 {betAmount}P
            {isSuccess && wonAmount > 0 && (
              <span className="text-[#CDFF00] font-bold"> · +{wonAmount}P</span>
            )}
          </p>
        )}
        {countdown != null && countdown > 0 && (
          <p className="text-white/60 text-xs mt-2">{countdown}초 후 계속</p>
        )}
      </div>
    </div>
  );
}
