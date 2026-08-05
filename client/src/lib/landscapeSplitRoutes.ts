/** 가로 master-detail 페이지 URL 매핑 */

export const HOME_NOTICE_BASE = "/home/notice";
export const HOME_INQUIRY_BASE = "/home/inquiry";
export const HOME_BOARD_BASE = "/home/board";
export const GAME_STORY_BASE = "/game/story";
export const GAME_INFO_BASE = "/game/info";

const LEGACY_TO_STORY: Record<string, string> = {
  "/victory-history": "victory",
  "/invitation": "invite",
  "/attendance": "attendance",
  "/ebook": "ebook",
  "/donation-history": "donation",
};

const LEGACY_TO_INFO: Record<string, string> = {
  "/verify-identity": "profile",
  "/profile": "profile",
  "/point": "point",
  "/faq": "faq",
  "/terms": "terms",
};

function splitPathQuery(path: string): [string, string] {
  const q = path.indexOf("?");
  if (q === -1) return [path, ""];
  return [path.slice(0, q), path.slice(q)];
}

function withQuery(base: string, query: string): string {
  return query ? `${base}${query}` : base;
}

export function isLandscapeSplitPath(pathname: string): boolean {
  return (
    pathname.startsWith(HOME_NOTICE_BASE) ||
    pathname.startsWith(HOME_INQUIRY_BASE) ||
    pathname.startsWith(HOME_BOARD_BASE) ||
    pathname.startsWith(GAME_STORY_BASE) ||
    pathname.startsWith(GAME_INFO_BASE)
  );
}

/** embed/레거시 경로 → split URL (해당 split 컨텍스트일 때만) */
export function mapPathForLandscapeSplit(currentPath: string, targetPath: string): string | null {
  const [targetBase, targetQuery] = splitPathQuery(targetPath);

  if (currentPath.startsWith(HOME_NOTICE_BASE)) {
    const m = targetBase.match(/^\/notice\/(\d+)$/);
    if (m) return withQuery(`${HOME_NOTICE_BASE}/${m[1]}`, targetQuery);
    if (targetBase === "/notice") return withQuery(HOME_NOTICE_BASE, targetQuery);
    return null;
  }

  if (currentPath.startsWith(HOME_INQUIRY_BASE)) {
    if (targetBase === "/inquiry/create") return withQuery(`${HOME_INQUIRY_BASE}/new`, targetQuery);
    const m = targetBase.match(/^\/inquiry\/(\d+)$/);
    if (m) return withQuery(`${HOME_INQUIRY_BASE}/${m[1]}`, targetQuery);
    if (targetBase === "/customer-center") return withQuery(HOME_INQUIRY_BASE, targetQuery);
    return null;
  }

  if (currentPath.startsWith(HOME_BOARD_BASE)) {
    if (targetBase === "/board/create") return withQuery(`${HOME_BOARD_BASE}/new`, targetQuery);
    const m = targetBase.match(/^\/board\/(\d+)$/);
    if (m) return withQuery(`${HOME_BOARD_BASE}/${m[1]}`, targetQuery);
    if (targetBase === "/board") return withQuery(HOME_BOARD_BASE, targetQuery);
    return null;
  }

  if (currentPath.startsWith(GAME_STORY_BASE)) {
    const section = LEGACY_TO_STORY[targetBase];
    if (section) return withQuery(`${GAME_STORY_BASE}/${section}`, targetQuery);
    return null;
  }

  if (currentPath.startsWith(GAME_INFO_BASE)) {
    const section = LEGACY_TO_INFO[targetBase];
    if (section) return withQuery(`${GAME_INFO_BASE}/${section}`, targetQuery);
    return null;
  }

  return null;
}

export function mapBackForLandscapeSplit(currentPath: string, fallbackPath: string): string | null {
  if (/^\/home\/notice\/\d+$/.test(currentPath)) return HOME_NOTICE_BASE;
  if (currentPath === `${HOME_INQUIRY_BASE}/new`) return HOME_INQUIRY_BASE;
  if (/^\/home\/inquiry\/\d+$/.test(currentPath)) return HOME_INQUIRY_BASE;
  if (currentPath === `${HOME_BOARD_BASE}/new`) return HOME_BOARD_BASE;
  if (/^\/home\/board\/\d+$/.test(currentPath)) return HOME_BOARD_BASE;

  if (currentPath.startsWith(GAME_STORY_BASE) || currentPath.startsWith(GAME_INFO_BASE)) {
    return "/prediction";
  }

  if (isLandscapeSplitPath(currentPath)) {
    if (fallbackPath === "/notice") return HOME_NOTICE_BASE;
    if (fallbackPath === "/customer-center") return HOME_INQUIRY_BASE;
    if (fallbackPath === "/board") return HOME_BOARD_BASE;
    if (fallbackPath === "/home") return "/home";
  }

  return null;
}
