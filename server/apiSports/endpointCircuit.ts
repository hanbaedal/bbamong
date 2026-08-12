/** API-Sports 미제공 엔드포인트 — 반복 호출·헬스 오염 방지 */

const DEFAULT_OPEN_MS = 24 * 60 * 60 * 1000;

const openUntil = new Map<string, number>();
const loggedOpen = new Set<string>();

export function isMissingEndpointError(message: string): boolean {
  return /endpoint do not exist|does not exist/i.test(message);
}

export function isEndpointCircuitOpen(path: string, now = Date.now()): boolean {
  const until = openUntil.get(path);
  if (until == null) return false;
  if (now >= until) {
    openUntil.delete(path);
    loggedOpen.delete(path);
    return false;
  }
  return true;
}

export function openEndpointCircuit(
  path: string,
  openMs = DEFAULT_OPEN_MS,
  now = Date.now(),
): void {
  openUntil.set(path, now + openMs);
  if (!loggedOpen.has(path)) {
    loggedOpen.add(path);
    console.warn(`[ApiSports] circuit open ${path} for ${Math.round(openMs / 3600000)}h (missing endpoint)`);
  }
}

/** 테스트·관리용 */
export function resetEndpointCircuits(): void {
  openUntil.clear();
  loggedOpen.clear();
}
