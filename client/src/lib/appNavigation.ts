import { getFullUrl, getOrRefreshAccessToken } from "./queryClient";

export const GAME_PATH = "/prediction";

export type MemberSessionKind = "none" | "guest" | "member";

export function isHomepageShopPath(path: string): boolean {
  const base = path.split("?")[0];
  return (
    base === "/" ||
    base === "/shop" ||
    base.startsWith("/shop/") ||
    base === "/home" ||
    base === "/home/shop" ||
    base.startsWith("/home/goods/")
  );
}

export async function fetchMemberSessionKind(): Promise<MemberSessionKind> {
  try {
    const token = await getOrRefreshAccessToken();
    if (!token) return "none";

    const res = await fetch(getFullUrl("/api/users/me"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return "none";

    const data = await res.json();
    if (!data.user) return "none";
    if (data.user.provider === "guest") return "guest";
    return "member";
  } catch {
    return "none";
  }
}

/** 게임 중 로고: 회원 → 회원 홈페이지, 게스트/비로그인 → 공개 홈페이지 */
export async function resolveHomepageUrl(): Promise<string> {
  const kind = await fetchMemberSessionKind();
  if (kind === "member") return "/home?shop=1";
  return "/";
}

export function navigateToHomepage(): void {
  void resolveHomepageUrl().then((url) => {
    window.location.assign(url);
  });
}

/** 홈페이지 로고: 게임으로 (기존 로그인·게스트 세션 유지) */
export function navigateToGame(): void {
  window.location.assign(GAME_PATH);
}
