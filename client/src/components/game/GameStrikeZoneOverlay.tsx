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

/** 플레이트 반폭(ft) — 홈플레이트 17인치 ≈ 0.708ft */
const PLATE_HALF = 0.71;

function clampOverflow(n: number, pad = 0.18): number {
  return Math.max(-pad, Math.min(1 + pad, n));
}

function resultColor(result?: string | null): string {
  const key = (result ?? "").toUpperCase();
  if (key === "B") return "#22C55E"; // 볼
  if (key === "T" || key === "C") return "#EF4444"; // 콜드 스트라이크
  if (key === "S") return "#F97316"; // 헛스윙
  if (key === "F") return "#A855F7"; // 파울
  if (key === "H") return "#EAB308"; // 타격(인플레이)
  return "#94A3B8";
}

export default function GameStrikeZoneOverlay({
  pitches,
  batsSide = "right",
  hidden = false,
}: GameStrikeZoneOverlayProps) {
  const fieldSize = useStadiumFieldSize();
  if (hidden || !pitches?.length) return null;

  const homePx = stadiumImagePointToPx(HOME_PLATE_IMAGE, fieldSize.width, fieldSize.height);
  // 홈 바로 위. 타자 반대쪽으로 아주 살짝만 밀어 점이 몸통에 안 가리게
  const zoneW = Math.min(fieldSize.width * 0.11, 92) * 0.9;
  const zoneH = zoneW * 1.35;
  const offsetX = batsSide === "left" ? -zoneW * 0.06 : zoneW * 0.06;
  const left = homePx.left + offsetX - zoneW / 2;
  const top = homePx.top - zoneH * 1.15;

  const topSz = pitches[pitches.length - 1]?.topSz || 3.5;
  const bottomSz = pitches[pitches.length - 1]?.bottomSz || 1.5;
  const szHeight = Math.max(0.5, topSz - bottomSz);

  return (
    <div
      className="absolute z-[28] overflow-visible pointer-events-none"
      style={{ left, top, width: zoneW, height: zoneH }}
      data-testid="game-strike-zone"
      data-bats-side={batsSide ?? "right"}
    >
      <div className="relative h-full w-full overflow-visible rounded-[2px] border border-white/70 bg-white/15 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]">
        {/* 3×3 그리드 */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-white/35" />
          ))}
        </div>
        {pitches.map((p, idx) => {
          // X: catcher view (+X = 1루/포수 오른쪽) → 화면 오른쪽
          const nx = clampOverflow((p.plateX + PLATE_HALF) / (PLATE_HALF * 2));
          const nz = clampOverflow((topSz - p.plateZ) / szHeight);
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
              title={`${p.pitchNum}구 ${p.result ?? ""} ${p.stuff ?? ""} ${p.speed ?? ""}`.trim()}
            >
              {p.pitchNum}
            </div>
          );
        })}
      </div>
    </div>
  );
}
