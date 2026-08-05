import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Package, Truck } from "lucide-react";
import AdminLayout from "./adminLayout";
import AdminPageShell from "./components/AdminPageShell";
import { adminTableClass, adminTableWrapClass } from "./components/adminPageStyles";
import { getFullUrl } from "@/lib/adminQueryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MALL_COURIER_OPTIONS,
  MALL_ORDER_STATUS_OPTIONS,
  normalizeMallOrderStatus,
  type MallOrderStatus,
} from "@shared/mallOps";

interface MallOrderItem {
  productId: number;
  productName: string;
  priceAmount: number;
  quantity: number;
  color?: string;
  size?: string;
}

interface MallOrder {
  id: number;
  userId: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  memo: string;
  items: MallOrderItem[];
  totalAmount: number;
  status: string;
  courierCompany?: string;
  trackingNumber?: string;
  shippedAt?: string;
  stockRestored?: boolean;
  createdAt: string;
}

const STATUS_FLOW = ["pending", "preparing", "shipped"] as const;
type FilterValue = "all" | (typeof STATUS_FLOW)[number] | "cancelled";

const STATUS_BADGE: Record<MallOrderStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  preparing: "bg-blue-50 text-blue-800 border-blue-200",
  shipped: "bg-green-50 text-green-800 border-green-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

function statusLabel(status: MallOrderStatus) {
  return MALL_ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function formatOrderDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function itemsSummary(items: MallOrderItem[]) {
  if (items.length === 0) return "-";
  const first = items[0].productName;
  if (items.length === 1) return `${first} × ${items[0].quantity}`;
  return `${first} 외 ${items.length - 1}건`;
}

function OrderStatusBadge({ status }: { status: MallOrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_BADGE[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  active,
  onClick,
}: {
  label: string;
  value: number;
  accent?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-3 text-left transition-colors min-w-0 ${
        active
          ? "border-[#E11936] bg-[#FFF5F6] ring-1 ring-[#E11936]/20"
          : "border-[#E9E9E9] bg-white hover:border-[#D0D0D0]"
      }`}
    >
      <p className="text-xs text-[#888] truncate">{label}</p>
      <p
        className={`text-xl lg:text-2xl font-bold mt-1 tabular-nums ${
          accent ? "text-[#E11936]" : "text-[#201E22]"
        }`}
      >
        {value.toLocaleString()}
      </p>
    </button>
  );
}

function OrderDetailPanel({
  order,
  draft,
  onDraftChange,
  onStatusChange,
  isPending,
}: {
  order: MallOrder;
  draft: { courierCompany: string; trackingNumber: string };
  onDraftChange: (patch: Partial<{ courierCompany: string; trackingNumber: string }>) => void;
  onStatusChange: (payload: {
    id: number;
    status?: string;
    courierCompany?: string;
    trackingNumber?: string;
  }) => void;
  isPending: boolean;
}) {
  const status = normalizeMallOrderStatus(order.status);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-3">
          <p className="text-xs font-semibold text-[#888] mb-2">주문 상품</p>
          <ul className="space-y-1.5">
            {order.items.map((item, idx) => (
              <li key={`${item.productId}-${idx}`} className="text-sm text-[#444] flex justify-between gap-2">
                <span className="min-w-0">
                  {item.productName}
                  {(item.color || item.size) && (
                    <span className="text-xs text-[#888] ml-1">
                      ({[item.color, item.size].filter(Boolean).join(" / ")})
                    </span>
                  )}
                  <span className="text-[#888]"> × {item.quantity}</span>
                </span>
                <span className="shrink-0 tabular-nums font-medium">
                  {(item.priceAmount * item.quantity).toLocaleString()}원
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-3">
          <p className="text-xs font-semibold text-[#888] mb-2">배송 정보</p>
          <p className="text-sm text-[#201E22] font-medium">{order.customerName}</p>
          <p className="text-sm text-[#666]">{order.customerPhone}</p>
          <p className="text-sm text-[#666] mt-1 whitespace-pre-wrap">{order.shippingAddress}</p>
          {order.memo && (
            <p className="text-xs text-[#888] mt-2 pt-2 border-t border-[#E9E9E9]">
              메모: {order.memo}
            </p>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 p-3 rounded-lg border border-[#E9E9E9] bg-white">
        <div>
          <Label className="text-xs text-[#666]">택배사</Label>
          <Select
            value={draft.courierCompany}
            onValueChange={(v) => onDraftChange({ courierCompany: v })}
          >
            <SelectTrigger className="h-9 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MALL_COURIER_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-[#666]">송장번호</Label>
          <Input
            className="h-9 mt-1"
            value={draft.trackingNumber}
            onChange={(e) => onDraftChange({ trackingNumber: e.target.value })}
            placeholder="송장번호 입력"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FLOW.map((next) => (
          <Button
            key={next}
            type="button"
            size="sm"
            variant={status === next ? "default" : "outline"}
            className={status === next ? "bg-[#E11936] hover:bg-[#B71C1C]" : ""}
            disabled={isPending}
            onClick={() =>
              onStatusChange({
                id: order.id,
                status: next,
                courierCompany: draft.courierCompany,
                trackingNumber: draft.trackingNumber,
              })
            }
          >
            {statusLabel(next)}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-[#888]"
          disabled={status === "cancelled" || isPending}
          onClick={() => onStatusChange({ id: order.id, status: "cancelled" })}
        >
          취소 (재고복구)
        </Button>
        {order.stockRestored && (
          <span className="text-xs text-green-700 ml-1">재고 복구됨</span>
        )}
        {order.shippedAt && (
          <span className="text-xs text-[#888] ml-auto">
            인계: {new Date(order.shippedAt).toLocaleString("ko-KR")}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MallOrderManagementPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { courierCompany: string; trackingNumber: string }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/mall/orders"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/admin/mall/orders"), { credentials: "include" });
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ orders: MallOrder[] }>;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: number;
      status?: string;
      courierCompany?: string;
      trackingNumber?: string;
    }) => {
      const res = await fetch(getFullUrl(`/api/admin/mall/orders/${payload.id}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "update failed");
      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/mall/orders"] });
    },
  });

  const allOrders = data?.orders ?? [];

  const statusCounts = useMemo(() => {
    const counts: Record<FilterValue, number> = {
      all: allOrders.length,
      pending: 0,
      preparing: 0,
      shipped: 0,
      cancelled: 0,
    };
    for (const order of allOrders) {
      const s = normalizeMallOrderStatus(order.status);
      counts[s] += 1;
    }
    return counts;
  }, [allOrders]);

  const filteredOrders = useMemo(() => {
    if (filter === "all") return allOrders;
    return allOrders.filter((o) => normalizeMallOrderStatus(o.status) === filter);
  }, [allOrders, filter]);

  const totalAmount = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0),
    [filteredOrders],
  );

  const getDraft = (order: MallOrder) =>
    drafts[order.id] ?? {
      courierCompany: order.courierCompany || MALL_COURIER_OPTIONS[0],
      trackingNumber: order.trackingNumber || "",
    };

  const setDraft = (order: MallOrder, patch: Partial<{ courierCompany: string; trackingNumber: string }>) => {
    setDrafts((prev) => {
      const current = prev[order.id];
      return {
        ...prev,
        [order.id]: {
          courierCompany: current?.courierCompany ?? (order.courierCompany || MALL_COURIER_OPTIONS[0]),
          trackingNumber: current?.trackingNumber ?? (order.trackingNumber || ""),
          ...patch,
        },
      };
    });
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <AdminLayout>
      <AdminPageShell
        title="주문 관리"
        description="주문 접수 → 발송 준비 → 택배사 인계"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5 lg:mb-6">
          <SummaryCard
            label="전체"
            value={statusCounts.all}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          {STATUS_FLOW.map((s) => (
            <SummaryCard
              key={s}
              label={statusLabel(s)}
              value={statusCounts[s]}
              accent={s === "pending"}
              active={filter === s}
              onClick={() => setFilter(s)}
            />
          ))}
          <SummaryCard
            label="취소"
            value={statusCounts.cancelled}
            active={filter === "cancelled"}
            onClick={() => setFilter("cancelled")}
          />
        </div>

        {!isLoading && filteredOrders.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-sm">
            <p className="text-[#666]">
              <span className="font-semibold text-[#201E22]">{filteredOrders.length}</span>건
              {filter !== "all" && (
                <span className="text-[#888]"> · {statusLabel(filter as MallOrderStatus)}</span>
              )}
            </p>
            <p className="text-[#201E22] font-semibold tabular-nums">
              합계 {totalAmount.toLocaleString()}원
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-lg border border-[#E9E9E9] bg-white p-8 text-center">
            <p className="text-sm text-[#888]">불러오는 중...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E0E0E0] bg-[#FAFAFA] p-10 text-center">
            <Package className="mx-auto h-10 w-10 text-[#CCC] mb-3" />
            <p className="text-sm text-[#888]">주문 내역이 없습니다.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className={`hidden lg:block ${adminTableWrapClass}`}>
              <table className={adminTableClass}>
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#E9E9E9] text-left text-xs text-[#888]">
                    <th className="px-4 py-3 font-medium w-10" />
                    <th className="px-4 py-3 font-medium">주문</th>
                    <th className="px-4 py-3 font-medium">고객</th>
                    <th className="px-4 py-3 font-medium">상품</th>
                    <th className="px-4 py-3 font-medium text-right">금액</th>
                    <th className="px-4 py-3 font-medium">상태</th>
                    <th className="px-4 py-3 font-medium">배송</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const status = normalizeMallOrderStatus(order.status);
                    const expanded = expandedId === order.id;
                    const draft = getDraft(order);
                    return (
                      <Fragment key={order.id}>
                        <tr
                          className={`border-b border-[#F0F0F0] hover:bg-[#FFFBFB] cursor-pointer transition-colors ${
                            expanded ? "bg-[#FFFBFB]" : "bg-white"
                          }`}
                          onClick={() => toggleExpand(order.id)}
                        >
                          <td className="px-4 py-3 text-[#888]">
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#201E22]">#{order.id}</p>
                            <p className="text-xs text-[#888] mt-0.5">{formatOrderDate(order.createdAt)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-[#201E22]">{order.customerName}</p>
                            <p className="text-xs text-[#888]">{order.customerPhone}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#444] max-w-[200px] truncate">
                            {itemsSummary(order.items)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#201E22]">
                            {order.totalAmount.toLocaleString()}원
                          </td>
                          <td className="px-4 py-3">
                            <OrderStatusBadge status={status} />
                          </td>
                          <td className="px-4 py-3 text-xs text-[#666]">
                            {order.trackingNumber ? (
                              <span className="inline-flex items-center gap-1">
                                <Truck className="h-3.5 w-3.5 shrink-0" />
                                {order.courierCompany} · {order.trackingNumber}
                              </span>
                            ) : (
                              <span className="text-[#BBB]">미입력</span>
                            )}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-[#FAFAFA] border-b border-[#E9E9E9]">
                            <td colSpan={7} className="px-4 py-4">
                              <OrderDetailPanel
                                order={order}
                                draft={draft}
                                onDraftChange={(patch) => setDraft(order, patch)}
                                onStatusChange={(payload) => updateMutation.mutate(payload)}
                                isPending={updateMutation.isPending}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet cards */}
            <div className="lg:hidden space-y-3">
              {filteredOrders.map((order) => {
                const status = normalizeMallOrderStatus(order.status);
                const expanded = expandedId === order.id;
                const draft = getDraft(order);
                return (
                  <article
                    key={order.id}
                    className="rounded-lg border border-[#E9E9E9] bg-white overflow-hidden shadow-sm"
                  >
                    <button
                      type="button"
                      className="w-full text-left p-4"
                      onClick={() => toggleExpand(order.id)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[#201E22]">#{order.id}</span>
                            <OrderStatusBadge status={status} />
                          </div>
                          <p className="text-xs text-[#888] mt-1">
                            {formatOrderDate(order.createdAt)} · {order.customerName}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-[#201E22] tabular-nums">
                            {order.totalAmount.toLocaleString()}원
                          </p>
                          <ChevronDown
                            className={`h-4 w-4 text-[#888] ml-auto mt-1 transition-transform ${
                              expanded ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </div>
                      <p className="text-sm text-[#666] truncate">{itemsSummary(order.items)}</p>
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-[#F0F0F0]">
                        <OrderDetailPanel
                          order={order}
                          draft={draft}
                          onDraftChange={(patch) => setDraft(order, patch)}
                          onStatusChange={(payload) => updateMutation.mutate(payload)}
                          isPending={updateMutation.isPending}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </AdminPageShell>
    </AdminLayout>
  );
}
