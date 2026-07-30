import type { CSSProperties } from "react";
import type { TeamSide } from "./fieldPositions";

interface GameFielderSpriteProps {
  side: TeamSide;
  facing?: number;
  className?: string;
  style?: CSSProperties;
}

/** 간단한 SVG 야구 수비수 — 홈=붉은 유니폼, 원정=하얀 유니폼 */
export default function GameFielderSprite({
  side,
  facing = 0,
  className = "",
  style,
}: GameFielderSpriteProps) {
  const isHome = side === "home";
  const jersey = isHome ? "#C41E3A" : "#F8F8F8";
  const pants = isHome ? "#9B1B30" : "#FFFFFF";
  const trim = isHome ? "#FFFFFF" : "#C41E3A";
  const cap = isHome ? "#8B0000" : "#F0F0F0";
  const skin = "#E8B796";

  return (
    <svg
      viewBox="0 0 32 48"
      className={className}
      aria-hidden
      style={{
        ...style,
        transform: `rotate(${facing}deg)`,
        transformOrigin: "50% 100%",
      }}
    >
      {/* 그림자 */}
      <ellipse cx="16" cy="46" rx="9" ry="2.5" fill="rgba(0,0,0,0.25)" />
      {/* 다리 */}
      <rect x="11" y="32" width="4" height="12" rx="1.5" fill={pants} stroke={trim} strokeWidth="0.6" />
      <rect x="17" y="32" width="4" height="12" rx="1.5" fill={pants} stroke={trim} strokeWidth="0.6" />
      {/* 몸통 */}
      <rect x="9" y="20" width="14" height="14" rx="3" fill={jersey} stroke={trim} strokeWidth="0.8" />
      {/* 팔 (수비 자세) */}
      <rect x="5" y="21" width="5" height="3" rx="1.5" fill={jersey} stroke={trim} strokeWidth="0.5" />
      <rect x="22" y="21" width="5" height="3" rx="1.5" fill={jersey} stroke={trim} strokeWidth="0.5" />
      {/* 글러브 */}
      <circle cx="6" cy="24" r="2.2" fill="#8B4513" />
      {/* 머리 */}
      <circle cx="16" cy="14" r="6" fill={skin} />
      {/* 모자 */}
      <ellipse cx="16" cy="11" rx="6.5" ry="3" fill={cap} stroke={trim} strokeWidth="0.6" />
      <rect x="10" y="10" width="12" height="2.5" rx="1" fill={cap} />
    </svg>
  );
}
