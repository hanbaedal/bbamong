/** 쇼핑몰 주문 상태 */
export type MallOrderStatus = "pending" | "preparing" | "shipped" | "cancelled";

export const MALL_ORDER_STATUS_OPTIONS: { value: MallOrderStatus; label: string }[] = [
  { value: "pending", label: "주문 접수" },
  { value: "preparing", label: "발송 준비" },
  { value: "shipped", label: "택배사 인계" },
  { value: "cancelled", label: "취소" },
];

export function normalizeMallOrderStatus(status: string): MallOrderStatus {
  if (status === "confirmed") return "preparing";
  if (status === "delivered") return "shipped";
  if (MALL_ORDER_STATUS_OPTIONS.some((o) => o.value === status)) {
    return status as MallOrderStatus;
  }
  return "pending";
}

export const MALL_COURIER_OPTIONS = [
  "CJ대한통운",
  "한진택배",
  "롯데택배",
  "우체국택배",
  "로젠택배",
  "쿠팡로켓",
  "기타",
] as const;

export type MallStockMovementType =
  | "receive"
  | "ship"
  | "adjust"
  | "cancel_restore"
  | "order_deduct";

export const MALL_STOCK_MOVEMENT_LABELS: Record<MallStockMovementType, string> = {
  receive: "입고",
  ship: "출고",
  adjust: "조정",
  cancel_restore: "주문취소 복구",
  order_deduct: "주문 차감",
};

export type MallPurchaseOrderStatus = "draft" | "ordered" | "partial" | "received" | "cancelled";

export const MALL_PURCHASE_STATUS_OPTIONS: { value: MallPurchaseOrderStatus; label: string }[] = [
  { value: "draft", label: "작성" },
  { value: "ordered", label: "발주" },
  { value: "partial", label: "부분입고" },
  { value: "received", label: "입고완료" },
  { value: "cancelled", label: "취소" },
];
