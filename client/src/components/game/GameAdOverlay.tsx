interface GameAdOverlayProps {
  message?: string;
}

export default function GameAdOverlay({ message = "광고가 재생 중입니다..." }: GameAdOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[50] flex items-center justify-center bg-black/85"
      data-testid="overlay-ad-playing"
    >
      <div className="flex flex-col items-center gap-4 px-8 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-[#CDFF00]/30 border-t-[#CDFF00] animate-spin" />
        <p className="text-white text-lg sm:text-xl font-semibold">{message}</p>
        <p className="text-white/60 text-sm">광고가 끝나면 예측 대기 화면으로 이동합니다</p>
      </div>
    </div>
  );
}
