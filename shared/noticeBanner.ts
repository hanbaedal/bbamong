/** 게임 배너 강조 태그 — 정렬·배지 스타일용 (닫기 후에는 재노출하지 않음) */
export function isPriorityNoticeTag(tag: string): boolean {
  return tag === "긴급" || tag === "중요" || tag === "우선" || tag === "필독";
}

export type NoticeDismissKind = "game" | "read";
