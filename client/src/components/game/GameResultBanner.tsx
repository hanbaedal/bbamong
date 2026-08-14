import type { PredictionOption } from "./gameTypes";
import successImg from "@assets/user/예측성공.webp";

interface GameResultBannerProps {
  phase: "success_announce" | "fail";
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
  const isSuccess = phase === "success_announce";

  if (isSuccess) {
    return (
      <div className="absolute inset-0 z-[36] pointer-events-none flex items-center justify-center">
        <div
          className="flex flex-col items-center text-center px-4"
          data-testid="banner-success"
        >
          <img
            src={successImg}
            alt=""
            className="w-[min(42vw,280px)] h-auto drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] animate-pyamong-success-home"
          />
          <p className="mt-2 text-2xl sm:text-3xl font-black text-[#39FF14] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            예측 성공!
          </p>
          {prediction && (
            <p className="text-white text-sm sm:text-base mt-1 font-semibold drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
              예측 {prediction} · 배팅 {betAmount}P
              {wonAmount > 0 && (
                <span className="text-[#CDFF00]"> · +{wonAmount}P</span>
              )}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 z-[35] pointer-events-none">
      <div
        className="px-6 py-3 rounded-xl shadow-xl text-center bg-[#3D1A1A]/90 border border-[#FF4444]"
        data-testid="banner-fail"
      >
        <p className="text-lg sm:text-xl font-bold text-[#FF6666]">예측 실패</p>
        {prediction && (
          <p className="text-white/90 text-sm mt-1">
            예측 {prediction} · 배팅 {betAmount}P
          </p>
        )}
        {countdown != null && countdown > 0 && (
          <p className="text-white/60 text-xs mt-2">{countdown}초 후 계속</p>
        )}
      </div>
    </div>
  );
}
