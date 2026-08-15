/** 투타 표기(우투우타, 좌투좌타, 우투좌타 …) → 타격 손 */
export type BatterHandSide = "left" | "right";

export function parseBatterHandSide(
  batsThrows: string | null | undefined,
): BatterHandSide | null {
  const raw = (batsThrows ?? "").replace(/\s+/g, "");
  if (!raw) return null;
  if (raw.includes("좌타")) return "left";
  if (raw.includes("우타")) return "right";
  return null;
}
