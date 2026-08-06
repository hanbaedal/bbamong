/** 회원 데이터 출처: 빠몽 vs 빠던9 레거시 */
export type MemberPlatform = "ppamong" | "badminton9";

export const MEMBER_SOURCE_PPAMONG = "ppamong" as const;
export const MEMBER_SOURCE_BADMINTON9 = "badminton9" as const;

export const MEMBER_GUEST_EXCLUSION = { provider: { $ne: "guest" } } as const;

/** MongoDB — 빠몽 앱에서 가입한 회원 */
export const PPAMONG_MEMBER_MONGO_FILTER = {
  dataSource: MEMBER_SOURCE_PPAMONG,
};

/** MongoDB — PG 동기화·레거시 (dataSource 없음은 기동/backfill 전까지 여기 포함) */
export const BADMINTON9_MEMBER_MONGO_FILTER = {
  $or: [
    { dataSource: MEMBER_SOURCE_BADMINTON9 },
    { dataSource: { $exists: false } },
    { dataSource: null },
    { dataSource: "" },
  ],
};

export function parseMemberPlatform(raw: unknown): MemberPlatform {
  return raw === "badminton9" ? "badminton9" : "ppamong";
}

export function memberPlatformFilter(platform: MemberPlatform): Record<string, unknown> {
  return platform === "ppamong" ? PPAMONG_MEMBER_MONGO_FILTER : BADMINTON9_MEMBER_MONGO_FILTER;
}

/** aggregation $lookup 후 user/inviter 문서 필터 */
export function buildUserPlatformMatchForAgg(
  fieldPrefix: string,
  platform: MemberPlatform,
): Record<string, unknown> {
  const f = (key: string) => `${fieldPrefix}.${key}`;
  const base: Record<string, unknown> = {
    [f("provider")]: { $ne: "guest" },
    [f("isSuspended")]: { $ne: 1 },
  };
  if (platform === "ppamong") {
    return { ...base, [f("dataSource")]: MEMBER_SOURCE_PPAMONG };
  }
  return {
    ...base,
    $or: [
      { [f("dataSource")]: MEMBER_SOURCE_BADMINTON9 },
      { [f("dataSource")]: { $exists: false } },
      { [f("dataSource")]: null },
      { [f("dataSource")]: "" },
    ],
  };
}

export interface MemberPlatformCounts {
  ppamong: number;
  badminton9: number;
}

export interface MemberListApiMeta {
  platform: MemberPlatform;
  counts: MemberPlatformCounts;
}
