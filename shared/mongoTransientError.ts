/** Mongo 트랜잭션 재시도 대상 — 예측 중지 레이스(자동 중지+운영자 탭)에서 500이 나던 경우 */
export function isMongoTransientError(error: unknown): boolean {
  const e = error as {
    code?: number;
    errorLabels?: string[];
    message?: string;
    name?: string;
  };
  if (e?.code === 112 || e?.code === 251 || e?.code === 11000 || e?.code === 16500) {
    return true;
  }
  if (
    Array.isArray(e?.errorLabels) &&
    e.errorLabels.some(
      (label) => label.includes("Transient") || label.includes("Retryable"),
    )
  ) {
    return true;
  }
  const msg = String(e?.message ?? "");
  return /WriteConflict|TransientTransactionError|NoSuchTransaction|duplicate key/i.test(
    msg,
  );
}
