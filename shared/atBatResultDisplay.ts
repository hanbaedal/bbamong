/**
 * 사용자에게 한 번만 크게 보여줄 타석 결과 문구.
 * 예측 버튼(1루·아웃 등)과 분리한다.
 *
 * 표시 집합: 포볼 / 사구 / 1루타 / 2루타 / 3루타 / 홈런 /
 * 타격아웃 / 삼진아웃 / 병살타 아웃 / 삼살타 아웃
 * 희생플라이·희생번트·뜬공·땅볼 → 타격아웃
 * 실책출루·야수선택·내야안타 → 1루타
 * 고의사구·볼넷 → 포볼
 */
export type LiveAtBatResultDisplay =
  | "1루타"
  | "2루타"
  | "3루타"
  | "포볼"
  | "사구"
  | "타격아웃"
  | "삼진아웃"
  | "병살타 아웃"
  | "삼살타 아웃"
  | "홈런";

export type LiveSuggestedPredictionResult = "1루" | "2루" | "3루" | "홈런" | "아웃";

/** 표시 라벨 → 예측/운영자 제안 버킷 */
export function mapAtBatResultDisplayToSuggested(
  display: LiveAtBatResultDisplay,
): LiveSuggestedPredictionResult {
  switch (display) {
    case "홈런":
      return "홈런";
    case "3루타":
      return "3루";
    case "2루타":
      return "2루";
    case "1루타":
    case "포볼":
    case "사구":
      return "1루";
    case "타격아웃":
    case "삼진아웃":
    case "병살타 아웃":
    case "삼살타 아웃":
      return "아웃";
  }
}

/**
 * 문자중계 문구 묶음에서 타석 결과 표시 라벨을 추정한다.
 * 우선순위: 홈런 → 삼살 → 병살 → 삼진 → 3·2루타 → 사구 → 포볼 → 1루타 → 타격아웃
 */
export function inferAtBatResultDisplayFromText(blob: string): LiveAtBatResultDisplay | null {
  const text = (blob ?? "").trim();
  if (!text) return null;

  if (/홈\s*런|홈런/.test(text)) return "홈런";
  if (/삼\s*살|트리플\s*플레[이이]|triple\s*play/i.test(text)) return "삼살타 아웃";
  if (/병살|더블\s*플레[이이]|겹살|double\s*play/i.test(text)) return "병살타 아웃";
  if (/삼진|스트라이크\s*아웃|strike\s*out/i.test(text)) return "삼진아웃";
  if (/3루\s*타|3루타/.test(text)) return "3루타";
  if (/2루\s*타|2루타/.test(text)) return "2루타";

  // 사구(몸에 맞는 볼) — 고의사구(포볼)와 구분
  if (/몸에\s*맞는|데드\s*볼|데드볼|hbp/i.test(text)) return "사구";
  if (/고의\s*사구/.test(text)) return "포볼";
  if (/사구로|사\s*구로|(?:^|[\s,./])사구(?:[\s,./]|$)/.test(text)) return "사구";

  if (/포\s*볼|볼\s*넷|볼넷|\bwalk\b/i.test(text)) return "포볼";

  if (/1루\s*타|내야안타|번트안타/.test(text)) return "1루타";
  if (/실책\s*출루|야수\s*선택|야수선택/.test(text)) return "1루타";
  // 단독 '안타' (피안타·안타수 문구 제외)
  if (/안타/.test(text) && !/피안타|안타수|안타\s*\d/.test(text)) return "1루타";

  if (
    /뜬공|플라이|희생\s*플라이|희생플라이|희생\s*번트|희생번트|땅볼|직선타|라이너|인필드\s*플라이|터치아웃|도루자|견제사|아웃/.test(
      text,
    )
  ) {
    return "타격아웃";
  }

  return null;
}

function compactPlayerName(name?: string | null): string {
  return (name ?? "").replace(/\s+/g, "");
}

/** 다음 타석이 이미 시작됐는지 — "1구 …" 만. 직전 타석의 "2구 스트라이크"는 새 타석이 아님 */
export function isNextPlateAppearancePitch(pitchLabel?: string | null): boolean {
  const m = (pitchLabel ?? "").trim().match(/^(\d+)\s*구/);
  if (!m) return false;
  return Number.parseInt(m[1]!, 10) === 1;
}

/**
 * 직전 타석 결과 문구를 다음 스냅샷에 붙일지.
 * 타자·투수가 바뀌었거나 다음 타석 1구가 나오면 붙이지 않는다.
 */
export function shouldCarryForwardAtBatResult(input: {
  prevResult?: string | null;
  prevBatterName?: string | null;
  nextBatterName?: string | null;
  prevPitcherName?: string | null;
  nextPitcherName?: string | null;
  nextPitchLabel?: string | null;
}): boolean {
  if (!input.prevResult) return false;
  const prevBatter = compactPlayerName(input.prevBatterName);
  const nextBatter = compactPlayerName(input.nextBatterName);
  if (prevBatter && nextBatter && prevBatter !== nextBatter) return false;
  const prevPitcher = compactPlayerName(input.prevPitcherName);
  const nextPitcher = compactPlayerName(input.nextPitcherName);
  if (prevPitcher && nextPitcher && prevPitcher !== nextPitcher) return false;
  if (isNextPlateAppearancePitch(input.nextPitchLabel)) return false;
  return true;
}
