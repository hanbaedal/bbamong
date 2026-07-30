export interface GameMatchItem {
  id: string;
  name: string;
  stadiumName: string;
  stadiumId: number;
  startTime: string;
  matchStatus: string;
  predictionEnabled?: boolean;
}

export function formatMatchTitle(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith("제 ")) return trimmed;
  return `제 ${trimmed}`;
}

export function matchOrderKey(name: string): number {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export function sortMatchesByOrder<T extends { name: string }>(matches: T[]): T[] {
  return [...matches].sort((a, b) => matchOrderKey(a.name) - matchOrderKey(b.name));
}

export function pickDefaultMatch(matches: GameMatchItem[]): GameMatchItem | null {
  if (matches.length === 0) return null;
  return sortMatchesByOrder(matches)[0] ?? null;
}

export interface StadiumOption {
  id: number;
  name: string;
}

export function collectStadiumOptions(matches: GameMatchItem[]): StadiumOption[] {
  const map = new Map<number, StadiumOption>();
  for (const match of matches) {
    if (match.stadiumId == null) continue;
    if (!map.has(match.stadiumId)) {
      map.set(match.stadiumId, { id: match.stadiumId, name: match.stadiumName });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function pickFirstMatchAtStadium(
  matches: GameMatchItem[],
  stadiumId: number,
): GameMatchItem | null {
  const atStadium = matches.filter((m) => m.stadiumId === stadiumId);
  return pickDefaultMatch(atStadium);
}
