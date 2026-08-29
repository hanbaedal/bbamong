import { normalizeRoundResultLabel } from "@/components/game/gameTypes";

/** 예측 결과 연출을 이미 본 predictionId — 메뉴 왕복·리마운트 후 재연출 방지 (탭 세션) */
const ACK_STORAGE_KEY = "ppamong.prediction.ackedResults";
/** 라운드+결과 — 미선택도 같은 큰 글씨를 한 번만 */
const ROUND_ACK_STORAGE_KEY = "ppamong.prediction.ackedRoundResults";

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

type RoundAckMap = Record<string, string[]>;
const MAX_ROUND_TOKENS_PER_MATCH = 40;

export function roundResultAckToken(
  round?: number | null,
  result?: string | null,
): string | null {
  const label = normalizeRoundResultLabel(result);
  if (!label) return null;
  if (typeof round !== "number" || !Number.isFinite(round)) return null;
  return `${Math.floor(round)}:${label}`;
}

function readRoundAckMap(): RoundAckMap {
  try {
    const raw = sessionStorage.getItem(ROUND_ACK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RoundAckMap;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeRoundAckMap(map: RoundAckMap): void {
  try {
    sessionStorage.setItem(ROUND_ACK_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

export function isRoundResultAcked(
  matchId: string,
  round?: number | null,
  result?: string | null,
): boolean {
  if (!matchId) return false;
  const token = roundResultAckToken(round, result);
  if (!token) return false;
  const tokens = readRoundAckMap()[matchId];
  return Array.isArray(tokens) && tokens.includes(token);
}

export function hasAnyRoundResultAcked(matchId: string, round?: number | null): boolean {
  if (!matchId || typeof round !== "number" || !Number.isFinite(round)) return false;
  const prefix = `${Math.floor(round)}:`;
  const tokens = readRoundAckMap()[matchId];
  return Array.isArray(tokens) && tokens.some((t) => typeof t === "string" && t.startsWith(prefix));
}

export function ackRoundResult(
  matchId: string,
  round?: number | null,
  result?: string | null,
): void {
  if (!matchId) return;
  const token = roundResultAckToken(round, result);
  if (!token) return;
  const map = readRoundAckMap();
  const prev = Array.isArray(map[matchId]) ? map[matchId] : [];
  if (prev.includes(token)) return;
  const next = [...prev, token];
  map[matchId] = next.length > MAX_ROUND_TOKENS_PER_MATCH ? next.slice(-MAX_ROUND_TOKENS_PER_MATCH) : next;
  writeRoundAckMap(map);
}
