/** 경기 데이터 출처: 빠몽(KBO·API) vs 빠던9 레거시 */
export type MatchPlatform = "ppamong" | "badminton9";

export function resolveMatchPlatform(match: {
  apiSportsGameId?: number | null;
  registrationOrder?: number | null;
}): MatchPlatform {
  if (match.apiSportsGameId != null && Number(match.apiSportsGameId) > 0) {
    return "ppamong";
  }
  if (match.registrationOrder != null && match.registrationOrder >= 1) {
    return "ppamong";
  }
  return "badminton9";
}

export function countMatchesByPlatform(
  matches: Array<{ apiSportsGameId?: number | null; registrationOrder?: number | null }>,
): { ppamong: number; badminton9: number } {
  let ppamong = 0;
  let badminton9 = 0;
  for (const m of matches) {
    if (resolveMatchPlatform(m) === "ppamong") ppamong += 1;
    else badminton9 += 1;
  }
  return { ppamong, badminton9 };
}
