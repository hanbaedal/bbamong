/**
 * API-SPORTS Baseball status.short 분류.
 * 주의: POST / POSTPONED = 연기(Postponed). FT만 정상 종료.
 * (과거 startsWith("POST")는 연기를 종료로 오인함)
 */

export function normalizeApiStatusShort(statusShort: string | null | undefined): string {
  return (statusShort || "").trim().toUpperCase();
}

/** 연기·취소·중단·몰수 등 — 정상 종료(FT)가 아님 */
export function isGamePostponedOrCancelled(statusShort: string | null | undefined): boolean {
  const short = normalizeApiStatusShort(statusShort);
  if (!short) return false;
  if (short === "PST" || short === "POST" || short === "POSTPONED") return true;
  if (short === "CAN" || short === "CANCELLED" || short === "CANCELED") return true;
  if (short === "ABD" || short === "ABANDONED") return true;
  if (short === "SUSP" || short === "SUSPENDED") return true;
  if (short.startsWith("POST") && short !== "POSTGAME") return true;
  return false;
}

/** 정상 종료만 (연장 포함 AOT) */
export function isGameFinished(statusShort: string | null | undefined): boolean {
  const short = normalizeApiStatusShort(statusShort);
  if (isGamePostponedOrCancelled(short)) return false;
  return short === "FT" || short === "FIN" || short === "AOT" || short === "END" || short === "RESULT";
}

/** 시작 전 (다음 스포츠 BEFORE/READY 포함 — 진행으로 오인 금지) */
export function isGameNotStarted(statusShort: string | null | undefined): boolean {
  const short = normalizeApiStatusShort(statusShort);
  return (
    short === "NS" ||
    short === "TBD" ||
    short === "SCHEDULED" ||
    short === "BEFORE" ||
    short === "READY" ||
    short === "WAIT" ||
    short === "PRE"
  );
}

/** NS/TBD·종료·연기가 아니면 live(진행)로 간주 */
export function isGameLiveStatus(statusShort: string | null | undefined): boolean {
  const short = normalizeApiStatusShort(statusShort);
  if (!short) return false;
  if (isGameNotStarted(short)) return false;
  if (isGameFinished(short)) return false;
  if (isGamePostponedOrCancelled(short)) return false;
  return true;
}

/** 스코어보드·경기관리 UI용 짧은 한글 라벨 */
export function apiStatusDisplayLabel(
  statusShort: string | null | undefined,
  statusLong?: string | null,
): string | null {
  const short = normalizeApiStatusShort(statusShort);
  if (!short) return null;

  if (isGameFinished(short)) return "경기 종료";
  if (short === "CAN" || short === "CANCELLED" || short === "CANCELED" || short === "ABD") {
    return "취소";
  }
  if (short === "SUSP" || short === "SUSPENDED") return "중단";
  if (isGamePostponedOrCancelled(short)) return "연기";
  if (isGameNotStarted(short)) return "시작 전";

  const long = (statusLong || "").toLowerCase();
  if (/postpon/.test(long)) return "연기";
  if (/cancel/.test(long)) return "취소";

  return null;
}

/** KBO·API 연기 확정 — stale 보정으로 경기중 오표시 방지 */
export function isConfirmedPostponedMatch(input: {
  matchStatus?: string | null;
  statusShort?: string | null;
  statusLong?: string | null;
  inningLabel?: string | null;
}): boolean {
  const short = normalizeApiStatusShort(input.statusShort);
  const long = (input.statusLong ?? "").toLowerCase();
  const label = (input.inningLabel ?? "").trim();

  if (label === "연기" || label === "취소" || label === "중단") return true;
  if (short === "PST" || short === "POSTPONED") return true;
  if (short === "CAN" || short === "CANCELLED" || short === "CANCELED" || short === "ABD") {
    return true;
  }
  if (/postpon|연기|postponement|time.*undecided|시간 미정/.test(long)) return true;
  if (input.matchStatus === "cancelled") {
    return !isGameNotStarted(short);
  }
  return false;
}
