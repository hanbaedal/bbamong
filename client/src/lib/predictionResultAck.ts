/** 예측 결과 연출을 이미 본 predictionId — 메뉴 왕복·리마운트 후 재연출 방지 (탭 세션) */
const ACK_STORAGE_KEY = "ppamong.prediction.ackedResults";

type AckMap = Record<string, number[]>;

const MAX_IDS_PER_MATCH = 40;

function readAckMap(): AckMap {
  try {
    const raw = sessionStorage.getItem(ACK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AckMap;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeAckMap(map: AckMap): void {
  try {
    sessionStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

export function isPredictionResultAcked(matchId: string, predictionId: number): boolean {
  if (!matchId || !Number.isFinite(predictionId)) return false;
  const ids = readAckMap()[matchId];
  return Array.isArray(ids) && ids.includes(predictionId);
}

export function ackPredictionResult(matchId: string, predictionId: number): void {
  if (!matchId || !Number.isFinite(predictionId)) return;
  const map = readAckMap();
  const prev = Array.isArray(map[matchId]) ? map[matchId] : [];
  if (prev.includes(predictionId)) return;
  const next = [...prev, predictionId];
  map[matchId] = next.length > MAX_IDS_PER_MATCH ? next.slice(-MAX_IDS_PER_MATCH) : next;
  writeAckMap(map);
}

export function listAckedPredictionResults(matchId: string): number[] {
  if (!matchId) return [];
  const ids = readAckMap()[matchId];
  return Array.isArray(ids) ? [...ids] : [];
}
