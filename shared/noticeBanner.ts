/** 게임 상단 배너 — 긴급·필독류는 dismiss 후에도 다시 표시 */
export function isPriorityNoticeTag(tag: string): boolean {
  return tag === "긴급" || tag === "중요" || tag === "우선" || tag === "필독";
}

export type NoticeDismissKind = "game" | "read";
