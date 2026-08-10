import { getKstDateKey } from "@/lib/kstDate";

const STORAGE_KEY = "ppamong.prediction.selectedMatch";

type StoredSelectedMatch = {
  dateKey: string;
  matchId: string;
};

/** 당일(KST)에 고른 예측 경기 — 홈/쇼핑몰 왕복 후에도 유지 */
export function readPersistedSelectedMatchId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSelectedMatch;
    if (!parsed?.matchId || typeof parsed.matchId !== "string") return null;
    if (parsed.dateKey !== getKstDateKey()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.matchId;
  } catch {
    return null;
  }
}

export function writePersistedSelectedMatchId(matchId: string | null): void {
  try {
    if (!matchId) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const payload: StoredSelectedMatch = {
      dateKey: getKstDateKey(),
      matchId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}
