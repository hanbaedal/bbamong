/** 예측 중지(3번) 화면 위 — 라운드 결과만 큰 글씨 (적중/빗나감 없음) */
export default function GameRoundResultFlash({
  result,
}: {
  result: string;
}) {
  return (
    <div
      className="absolute inset-0 z-[40] flex items-center justify-center pointer-events-none"
      data-testid="overlay-round-result-flash"
    >
      <p className="text-[clamp(2.75rem,12vw,6.5rem)] font-black leading-none tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]">
        {result}
      </p>
    </div>
  );
}
