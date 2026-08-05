/** 가로 split 페이지 — 기능별 컬러 테마 */

export type LandscapeTheme = "notice" | "inquiry" | "board" | "story" | "info";

export const LANDSCAPE_THEME_CLASS: Record<LandscapeTheme, string> = {
  notice: "lscape-theme-notice",
  inquiry: "lscape-theme-inquiry",
  board: "lscape-theme-board",
  story: "lscape-theme-story",
  info: "lscape-theme-info",
};
