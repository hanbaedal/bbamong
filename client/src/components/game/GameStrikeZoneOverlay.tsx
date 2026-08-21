/** 네이버 ptsOptions 기반 스트라이크존 투구 위치 오버레이 */
import type { LivePitchLocation } from "@shared/apiSportsTypes";
import { HOME_PLATE_IMAGE, stadiumImagePointToPx } from "./stadiumFieldCoords";
import { useStadiumFieldSize } from "./StadiumFieldContext";

interface GameStrikeZoneOverlayProps {
  pitches: LivePitchLocation[] | null | undefined;
  /** 우타면 존이 화면 왼쪽 박스 쪽, 좌타면 오른쪽 */
  batsSide?: "left" | "right" | null;
  hidden?: boolean;
}

/** 플레이트 반폭(ft) — 스트라이크존 가로 */
const PLATE_HALF = 0.83;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function resultColor(result?: string | null): string {
  const key = (result ?? "").toUpperCase();
  if (key === "B") return "#22C55E";
  if (key === "H") return "#F97316";
  return "#F97316";
}

export default function GameStrikeZoneOverlay({
  pitches,
  batsSide = "right",
  hidden = false,
}: GameStrikeZoneOverlayProps) {
  const fieldSize = useStadiumFieldSize();
  if (hidden || !pitches?.length) return null;

  const homePx = stadiumImagePointToPx(HOME_PLATE_IMAGE, fieldSize.width, fieldSize.height);
  // 홈 플레이트 바로 위, 타자 박스 앞쪽에 존 배치
  const zoneW = Math.min(fieldSize.width * 0.11, 92);
  const zoneH = zoneW * 1.35;
  const offsetX = batsSide === "left" ? zoneW * 0.15 : -zoneW * 0.15;
  const left = homePx.left + offsetX - zoneW / 2;
  const top = homePx.top - zoneH * 1.15;

  const topSz = pitches[pitches.length - 1]?.topSz || 3.5;
  const bottomSz = pitches[pitches.length - 1]?.bottomSz || 1.5;
  const szHeight = Math.max(0.5, topSz - bottomSz);

  return (
    <div
      className="absolute z-[28] pointer-events-none"
      style={{ left, top, width: zoneW, height: zoneH }}
      data-testid="game-strike-zone"
      data-bats-side={batsSide ?? "right"}
    >
      <div className="relative h-full w-full rounded-[2px] border border-white/70 bg-white/15 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]">
        {/* 3×3 그리드 */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-white/35" />
          ))}
        </div>
        {pitches.map((p, idx) => {
          // X: -PLATE_HALF..PLATE_HALF → 0..1 (투수 시점에서 오른쪽이 +X)
          const nx = clamp01((p.plateX + PLATE_HALF) / (PLATE_HALF * 2));
          const nz = clamp01((topSz - p.plateZ) / szHeight);
          const size = Math.max(14, zoneW * 0.18);
          return (
            <div
              key={`${p.pitchNum}-${idx}`}
              className="absolute flex items-center justify-center rounded-full border-2 border-white/90 text-[9px] font-bold text-white shadow"
              style={{
                width: size,
                height: size,
                left: `${nx * 100}%`,
                top: `${nz * 100}%`,
                transform: "translate(-50%, -50%)",
                backgroundColor: resultColor(p.result),
              }}
              data-testid={`strike-zone-pitch-${p.pitchNum}`}
              title={`${p.pitchNum}구 ${p.stuff ?? ""} ${p.speed ?? ""}`.trim()}
            >
              {p.pitchNum}
            </div>
          );
        })}
      </div>
    </div>
  );
}
