/** 메뉴 왕복·리마운트 후에도 같은 경기 첫 안내를 반복하지 않음 (탭 세션) */
const STORAGE_KEY = "ppamong.gameVoice.session.v1";

type VoiceSessionState = {
  firstOpenMatchIds: string[];
  liveSpokenMatchIds: string[];
  pregameSpokenMatchIds: string[];
  overlaySpoken: string | null;
};

function emptyState(): VoiceSessionState {
  return {
    firstOpenMatchIds: [],
    liveSpokenMatchIds: [],
    pregameSpokenMatchIds: [],
    overlaySpoken: null,
  };
}

function readState(): VoiceSessionState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<VoiceSessionState>;
    return {
      firstOpenMatchIds: Array.isArray(parsed.firstOpenMatchIds) ? parsed.firstOpenMatchIds : [],
      liveSpokenMatchIds: Array.isArray(parsed.liveSpokenMatchIds) ? parsed.liveSpokenMatchIds : [],
      pregameSpokenMatchIds: Array.isArray(parsed.pregameSpokenMatchIds)
        ? parsed.pregameSpokenMatchIds
        : [],
      overlaySpoken: typeof parsed.overlaySpoken === "string" ? parsed.overlaySpoken : null,
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: VoiceSessionState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private */
  }
}

function rememberId(list: string[], id: string): string[] {
  if (list.includes(id)) return list;
  const next = [...list, id];
  return next.length > 20 ? next.slice(-20) : next;
}

/** 당일·경기 첫 예측 열림만 '경기가 시작되었습니다' */
export function consumeFirstPredictionOpen(matchId?: string | null): boolean {
  if (!matchId) {
    const state = readState();
    if (state.firstOpenMatchIds.includes("__any__")) return false;
    writeState({ ...state, firstOpenMatchIds: rememberId(state.firstOpenMatchIds, "__any__") });
    return true;
  }
  const state = readState();
  if (state.firstOpenMatchIds.includes(matchId)) return false;
  writeState({ ...state, firstOpenMatchIds: rememberId(state.firstOpenMatchIds, matchId) });
  return true;
}

export function consumeLiveMatchVoice(matchId: string): boolean {
  const state = readState();
  if (state.liveSpokenMatchIds.includes(matchId)) return false;
  writeState({ ...state, liveSpokenMatchIds: rememberId(state.liveSpokenMatchIds, matchId) });
  return true;
}

export function consumePregameMatchVoice(matchId: string): boolean {
  const state = readState();
  if (state.pregameSpokenMatchIds.includes(matchId)) return false;
  writeState({
    ...state,
    pregameSpokenMatchIds: rememberId(state.pregameSpokenMatchIds, matchId),
  });
  return true;
}

export function consumeOverlayVoice(kind: string): boolean {
  const state = readState();
  if (state.overlaySpoken === kind) return false;
  writeState({ ...state, overlaySpoken: kind });
  return true;
}

export function clearOverlayVoiceMark(): void {
  const state = readState();
  if (state.overlaySpoken == null) return;
  writeState({ ...state, overlaySpoken: null });
}
