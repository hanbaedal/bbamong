/** 이번 광고 세션을 X로 끈 시각 — 복귀·재연결 시 같은 광고를 다시 띄우지 않음 */

const STORAGE_KEY = "ppamong.ad.dismissedStartedAt";

type DismissMap = Record<string, number>;

function readMap(): DismissMap {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissMap;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeMap(map: DismissMap): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function markAdSessionDismissed(matchId: string, startedAt: number | null | undefined): void {
  if (!matchId || startedAt == null || !Number.isFinite(startedAt)) return;
  const map = readMap();
  map[matchId] = startedAt;
  writeMap(map);
}

export function wasAdSessionDismissed(matchId: string, startedAt: number | null | undefined): boolean {
  if (!matchId || startedAt == null || !Number.isFinite(startedAt)) return false;
  return readMap()[matchId] === startedAt;
}

export function clearAdSessionDismissed(matchId: string | null | undefined): void {
  if (!matchId) return;
  const map = readMap();
  if (!(matchId in map)) return;
  delete map[matchId];
  writeMap(map);
}
