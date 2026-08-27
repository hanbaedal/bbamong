/** 운영자 진행 순서 오류 — HTTP 400으로 안내 (500이 아님) */
export function isOperatorControlFlowError(message: string): boolean {
  return (
    message.includes("결과") ||
    message.includes("예측") ||
    message.includes("중지") ||
    message.includes("경기전에") ||
    message.includes("3아웃") ||
    message.includes("다음 타자") ||
    message.includes("공수") ||
    message.includes("실황") ||
    message.includes("찾을 수 없")
  );
}

export function operatorControlErrorStatus(error: unknown): {
  status: number;
  message: string;
} {
  const message = error instanceof Error ? error.message : "처리에 실패했습니다.";
  if (isOperatorControlFlowError(message)) {
    return { status: 400, message };
  }
  return { status: 500, message };
}
