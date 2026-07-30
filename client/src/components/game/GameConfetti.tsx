import { useEffect, useMemo } from "react";

const COLORS = ["#FFD700", "#FF6B6B", "#4ECDC4", "#CDFF00", "#FF9F43", "#A29BFE"];

interface GameConfettiProps {
  active: boolean;
  count?: number;
}

export default function GameConfetti({ active, count = 48 }: GameConfettiProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 17) % 100}%`,
        delay: `${(i % 12) * 0.08}s`,
        duration: `${1.8 + (i % 5) * 0.25}s`,
        color: COLORS[i % COLORS.length],
        size: 6 + (i % 4) * 2,
      })),
    [count],
  );

  useEffect(() => {
    if (!active) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      setTimeout(() => void ctx.close(), 600);
    } catch {
      /* Web Audio 미지원 시 무시 */
    }
  }, [active]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 rounded-sm"
          style={{
            left: p.left,
            width: p.size,
            height: p.size * 1.4,
            backgroundColor: p.color,
            animation: `confetti-fall ${p.duration} linear ${p.delay} 1 forwards`,
          }}
        />
      ))}
    </div>
  );
}
