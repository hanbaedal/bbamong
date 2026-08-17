export function resolveMatchOrder(
  assignedMatchNumber?: string | null,
  operatorSlot?: number,
): number | null {
  const fromName = assignedMatchNumber?.match(/(\d+)/)?.[1];
  if (fromName) return parseInt(fromName, 10);
  if (operatorSlot && operatorSlot > 0) return operatorSlot;
  return null;
}

export function operatorLoginDuringMessage(
  assignedMatchNumber?: string | null,
  operatorSlot?: number,
): string {
  const order = resolveMatchOrder(assignedMatchNumber, operatorSlot);
  return order
    ? `제 ${order}경기 운영자가 로그인하고 있습니다...`
    : "경기 운영자가 로그인하고 있습니다...";
}

export function operatorLoginSuccessMessage(
  assignedMatchNumber?: string | null,
  operatorSlot?: number,
): string {
  const order = resolveMatchOrder(assignedMatchNumber, operatorSlot);
  return order
    ? `제 ${order}번째 경기 운영자가 로그인되었습니다.`
    : "경기 운영자가 로그인되었습니다.";
}

export { speakKorean } from "./speakKorean";
