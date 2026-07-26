import type { ApiSportsHealthStatus } from "@shared/apiSportsTypes";
import { HEALTH_STALE_MS, LIVE_SCORE_SYNC_INTERVAL_MS, MATCH_MGMT_SCHEDULED_SYNC_MS } from "./constants";
import { isLiveScoreSyncActive } from "./liveScoreSync";

interface HealthState {
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  lastLatencyMs: number | null;
}

const state: HealthState = {
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  lastLatencyMs: null,
};

export function markApiSportsSuccess(latencyMs: number) {
  state.lastSuccessAt = new Date();
  state.lastLatencyMs = latencyMs;
  state.lastError = null;
}

export function markApiSportsError(message: string) {
  state.lastErrorAt = new Date();
  state.lastError = message;
}

export function getApiSportsHealth(): ApiSportsHealthStatus {
  const apiKeyConfigured = Boolean(process.env.API_SPORTS_KEY?.trim());
  const now = Date.now();
  const healthy =
    apiKeyConfigured &&
    state.lastSuccessAt !== null &&
    now - state.lastSuccessAt.getTime() <= HEALTH_STALE_MS;

  return {
    healthy,
    lastSuccessAt: state.lastSuccessAt?.toISOString() ?? null,
    lastErrorAt: state.lastErrorAt?.toISOString() ?? null,
    lastError: state.lastError,
    pollIntervalMs: isLiveScoreSyncActive() ? LIVE_SCORE_SYNC_INTERVAL_MS : MATCH_MGMT_SCHEDULED_SYNC_MS,
    latencyMs: state.lastLatencyMs,
    apiKeyConfigured,
  };
}
