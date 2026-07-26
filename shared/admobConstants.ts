/** Google 공식 샘플·테스트 퍼블리셔 번호 (운영 빌드에서 사용 금지) */
export const GOOGLE_ADMOB_TEST_PUBLISHER_NUM = "3940256099942544";

export function isGoogleTestAdMobId(id: string | undefined | null): boolean {
  if (!id?.trim()) return false;
  return id.includes(GOOGLE_ADMOB_TEST_PUBLISHER_NUM);
}

export function trimAdMobId(id: string | undefined | null): string {
  return id?.trim() ?? "";
}
