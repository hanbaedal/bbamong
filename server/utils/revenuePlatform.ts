/** 수익·광고 데이터 출처: 빠몽 vs 빠던9 레거시 */
export type RevenuePlatform = "ppamong" | "badminton9";

export const REVENUE_SOURCE_PPAMONG = "ppamong" as const;
export const REVENUE_SOURCE_BADMINTON9 = "badminton9" as const;

/** MongoDB — 빠몽에서 등록·운영하는 수익 관련 데이터 */
export const PPAMONG_REVENUE_MONGO_FILTER = {
  dataSource: REVENUE_SOURCE_PPAMONG,
};

/** MongoDB — PG 동기화·레거시 (dataSource 없음 포함) */
export const BADMINTON9_REVENUE_MONGO_FILTER = {
  $or: [
    { dataSource: REVENUE_SOURCE_BADMINTON9 },
    { dataSource: { $exists: false } },
    { dataSource: null },
    { dataSource: "" },
  ],
};

export function revenuePlatformFilter(platform: RevenuePlatform): Record<string, unknown> {
  return platform === "ppamong" ? PPAMONG_REVENUE_MONGO_FILTER : BADMINTON9_REVENUE_MONGO_FILTER;
}
