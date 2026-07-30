/** 게임 화면 iframe 임베드 — 헤더·푸터 숨김 */
export function isGameEmbedMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("embed") === "1";
}

export function buildGameEmbedUrl(path: string): string {
  const base = path.split("?")[0];
  return `${base}?embed=1`;
}
