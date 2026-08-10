/** 가로 master-detail 페이지 URL 매핑 */

import { GAME_INFO_BASE, GAME_STORY_BASE } from "@/lib/gameSplitConfig";

export const HOME_NOTICE_BASE = "/home/notice";
export const HOME_INQUIRY_BASE = "/home/inquiry";
export const HOME_BOARD_BASE = "/home/board";
export { GAME_STORY_BASE, GAME_INFO_BASE };

const LEGACY_TO_STORY: Record<string, string> = {
  "/victory-history": "victory",
  "/invitation": "invite",
  "/attendance": "attendance",
  "/ebook": "ebook",
  "/donation-history": "donation",
};

const LEGACY_TO_INFO: Record<string, string> = {
  "/verify-identity": "profile",
  "/profile": "profile-edit",
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

/** 레거시(/notice, /board …) 또는 split URL → 가로 split 경로 (전역) */
export function resolveLegacyPathToSplit(targetPath: string): string | null {
  const [targetBase, targetQuery] = splitPathQuery(targetPath);

  if (isLandscapeSplitPath(targetBase)) {
    return withQuery(targetBase, targetQuery);
  }

  let m = targetBase.match(/^\/notice\/(\d+)$/);
  if (m) return withQuery(`${HOME_NOTICE_BASE}/${m[1]}`, targetQuery);
  if (targetBase === "/notice") return withQuery(HOME_NOTICE_BASE, targetQuery);

  if (targetBase === "/inquiry/create") return withQuery(`${HOME_INQUIRY_BASE}/new`, targetQuery);
  m = targetBase.match(/^\/inquiry\/(\d+)$/);
  if (m) return withQuery(`${HOME_INQUIRY_BASE}/${m[1]}`, targetQuery);
  if (targetBase === "/customer-center") return withQuery(HOME_INQUIRY_BASE, targetQuery);

  if (targetBase === "/board/create") return withQuery(`${HOME_BOARD_BASE}/new`, targetQuery);
  m = targetBase.match(/^\/board\/(\d+)$/);
  if (m) return withQuery(`${HOME_BOARD_BASE}/${m[1]}`, targetQuery);
  if (targetBase === "/board") return withQuery(HOME_BOARD_BASE, targetQuery);

  const story = LEGACY_TO_STORY[targetBase];
  if (story) return withQuery(`${GAME_STORY_BASE}/${story}`, targetQuery);

  const info = LEGACY_TO_INFO[targetBase];
  if (info) return withQuery(`${GAME_INFO_BASE}/${info}`, targetQuery);

  return null;
}

/** 홈·게임 — split URL로 이동 (레거시 경로 자동 변환) */
export function navigateUserApp(path: string, setLocation: (to: string) => void): void {
  setLocation(resolveLegacyPathToSplit(path) ?? path);
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
    if (targetBase === "/customer-center" || targetBase === HOME_INQUIRY_BASE) {
      return withQuery(HOME_INQUIRY_BASE, targetQuery);
    }
    return null;
  }

  if (currentPath.startsWith(HOME_BOARD_BASE)) {
    if (targetBase === "/board/create") return withQuery(`${HOME_BOARD_BASE}/new`, targetQuery);
    const m = targetBase.match(/^\/board\/(\d+)$/);
    if (m) return withQuery(`${HOME_BOARD_BASE}/${m[1]}`, targetQuery);
    if (targetBase === "/board" || targetBase === HOME_BOARD_BASE) {
      return withQuery(HOME_BOARD_BASE, targetQuery);
    }
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

  if (currentPath === `${GAME_INFO_BASE}/profile-edit`) {
    if (fallbackPath === "/verify-identity" || fallbackPath === "/profile") {
      return `${GAME_INFO_BASE}/profile`;
    }
  }

  if (currentPath.startsWith(GAME_STORY_BASE) || currentPath.startsWith(GAME_INFO_BASE)) {
    if (
      fallbackPath === "/home" ||
      fallbackPath === "/verify-identity" ||
      fallbackPath === "/profile" ||
      fallbackPath === "/customer-center" ||
      fallbackPath === "/board" ||
      fallbackPath === "/notice"
    ) {
      return "/prediction";
    }
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
