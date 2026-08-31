import { getKstDateKey } from "@/lib/kstDate";

const STORAGE_KEY = "ppamong.delay.selectedMatch";

type StoredSelectedMatch = {
  dateKey: string;
  matchId: string;
};

/** 딜레이 전용. 실시간 `ppamong.prediction.selectedMatch` 와 키를 공유하지 않는다. */
export function readPersistedDelayMatchId(): string | null {
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

export function writePersistedDelayMatchId(matchId: string | null): void {
  try {
    if (!matchId) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ dateKey: getKstDateKey(), matchId } satisfies StoredSelectedMatch),
    );
  } catch {
    // ignore quota / private mode
  }
}
