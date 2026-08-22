import type { LiveScoreSituation } from "./apiSportsTypes";

/** pitchLabel 예: "3구 볼" → 3 */
export function extractPitchNumFromLabel(label?: string | null): number | null {
  const m = (label ?? "").trim().match(/^(\d+)구/);
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * pitchLabel / 문자중계 문구에서 투구 결과 키 추출.
 * 예: "3구 볼" → "B", "2구 스트라이크" → "T", "1구 파울" → "F"
 * ptsOptions 좌표와 무관 — 카운트(B-S) 보정용.
 */
export function extractPitchResultKeyFromLabel(label?: string | null): string | null {
  const raw = (label ?? "").trim();
  if (!raw) return null;
  const afterPitch = raw.replace(/^\d+구\s*/, "").trim();
  const blob = afterPitch || raw;
  if (/볼넷|포\s*볼|사\s*구|데드\s*볼|몸에\s*맞는/i.test(blob)) return "B";
  if (/헛스윙/.test(blob)) return "S";
  if (/파울/.test(blob)) return "F";
  if (/스트라이크/.test(blob)) return "T";
  if (/^(볼)\b/.test(blob) || /\b볼$/.test(blob) || blob === "볼") return "B";
  if (/타격|안타|홈\s*런|루타|뜬공|땅볼|직선|삼진|아웃/.test(blob)) return "H";
  const upper = blob.toUpperCase();
  if (upper === "B" || upper === "T" || upper === "C" || upper === "S" || upper === "F" || upper === "H") {
    return upper;
  }
  return null;
}

/** 야구 타석 카운트 규칙으로 B/S 한 투구 반영 (파울은 2S에서 유지) */
export function applyPitchResultToBallsStrikes(
  balls: number,
  strikes: number,
  resultKey: string | null | undefined,
): { balls: number; strikes: number } {
  const key = (resultKey ?? "").trim().toUpperCase();
  let b = Math.max(0, Math.min(3, balls));
  let s = Math.max(0, Math.min(2, strikes));
  if (key === "B") {
    b = Math.min(3, b + 1);
  } else if (key === "T" || key === "C" || key === "S") {
    s = Math.min(2, s + 1);
  } else if (key === "F" && s < 2) {
    s = Math.min(2, s + 1);
  }
  return { balls: b, strikes: s };
}

/** 더 앞선(투구 반영이 많은) B-S를 고른다. 동점이면 prefer를 유지. */
export function preferAheadBallsStrikes(
  prefer: { balls: number; strikes: number },
  other: { balls: number; strikes: number },
): { balls: number; strikes: number } {
  const preferTotal = prefer.balls + prefer.strikes;
  const otherTotal = other.balls + other.strikes;
  if (otherTotal > preferTotal) return { balls: other.balls, strikes: other.strikes };
  if (preferTotal > otherTotal) return { balls: prefer.balls, strikes: prefer.strikes };
  if (other.balls > prefer.balls || other.strikes > prefer.strikes) {
    return { balls: other.balls, strikes: other.strikes };
  }
  return { balls: prefer.balls, strikes: prefer.strikes };
}

/**
 * 네이버 currentGameState 가 한 박자 늦을 때
 * 1) ptsOptions(pitchLocations) 결과로 B-S 보정
 * 2) pts가 아직 없으면 pitchLabel(문자: "N구 볼")로 B-S 보정
 * 존 좌표(pitchLocations)는 건드리지 않는다 — 점은 pts 전용.
 */
export function coalesceLiveSituation(
  next: LiveScoreSituation,
  prev: LiveScoreSituation | null | undefined,
): LiveScoreSituation {
  if (!prev) return next;

  const nextNum = extractPitchNumFromLabel(next.pitchLabel);
  const prevNum = extractPitchNumFromLabel(prev.pitchLabel);
  const ptsLen = next.pitchLocations?.length ?? 0;
  const prevPtsLen = prev.pitchLocations?.length ?? 0;
  const pitchAdvanced =
    nextNum != null && prevNum != null
      ? nextNum > prevNum
      : ptsLen > prevPtsLen ||
        (Boolean(next.pitchLabel) && next.pitchLabel !== prev.pitchLabel);

  if (!pitchAdvanced) return next;

  // 이미 state 카운트가 갱신됐으면 유지
  if (next.balls !== prev.balls || next.strikes !== prev.strikes) return next;

  let resultKey: string | null = null;
  const last = next.pitchLocations?.[ptsLen - 1];
  if (last?.result) {
    resultKey = last.result.trim().toUpperCase();
  } else {
    // pts 지연: 문자 라벨만으로 B-S 전진 (좌표/점은 추가하지 않음)
    resultKey = extractPitchResultKeyFromLabel(next.pitchLabel);
  }
  if (!resultKey || resultKey === "H") return next;

  const bumped = applyPitchResultToBallsStrikes(next.balls, next.strikes, resultKey);
  if (bumped.balls === next.balls && bumped.strikes === next.strikes) return next;

  return { ...next, balls: bumped.balls, strikes: bumped.strikes };
}
