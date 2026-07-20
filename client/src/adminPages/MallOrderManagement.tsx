import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "./adminLayout";
import AdminPageShell from "./components/AdminPageShell";
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
import { MALL_COURIER_OPTIONS, MALL_ORDER_STATUS_OPTIONS, normalizeMallOrderStatus } from "@shared/mallOps";

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

export default function MallOrderManagementPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [drafts, setDrafts] = useState<Record<number, { courierCompany: string; trackingNumber: string }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/mall/orders", filter],
    queryFn: async () => {
      const q = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(getFullUrl(`/api/admin/mall/orders${q}`), { credentials: "include" });
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

  const orders = data?.orders ?? [];

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

  return (
    <AdminLayout>
      <AdminPageShell
        title="주문 관리"
        description="주문 접수 → 발송 준비 → 택배사 인계"
        headerExtra={
          <div className="flex flex-wrap gap-2 mb-4 lg:mb-5 shrink-0">
            {["all", ...STATUS_FLOW, "cancelled"].map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={filter === s ? "default" : "outline"}
                className={filter === s ? "bg-[#E11936] hover:bg-[#B71C1C]" : ""}
                onClick={() => setFilter(s)}
              >
                {s === "all"
                  ? "전체"
                  : MALL_ORDER_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s}
              </Button>
            ))}
          </div>
        }
      >
      {isLoading ? (
        <p className="text-sm text-[#888]">불러오는 중...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-[#888]">주문 내역이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {orders.map((order) => {
            const status = normalizeMallOrderStatus(order.status);
            const draft = getDraft(order);
            return (
              <div key={order.id} className="border border-[#E9E9E9] rounded-lg p-4 bg-white">
                <div className="flex flex-wrap justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-[#201E22]">
                      주문 #{order.id}{" "}
                      <span className="text-sm font-normal text-[#E11936]">
                        {MALL_ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
                      </span>
                    </p>
                    <p className="text-xs text-[#888]">
                      {new Date(order.createdAt).toLocaleString("ko-KR")} · 회원 {order.userId}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-[#201E22]">
                    {order.totalAmount.toLocaleString()}원
                  </span>
                </div>

                <ul className="text-sm text-[#444] mb-3 space-y-1">
                  {order.items.map((item, idx) => (
                    <li key={`${item.productId}-${idx}`}>
                      {item.productName} × {item.quantity} —{" "}
                      {(item.priceAmount * item.quantity).toLocaleString()}원
                    </li>
                  ))}
                </ul>

                <p className="text-sm text-[#666] mb-1">
                  {order.customerName} · {order.customerPhone}
                </p>
                <p className="text-sm text-[#666] mb-3 whitespace-pre-wrap">{order.shippingAddress}</p>
                {order.memo && <p className="text-xs text-[#888] mb-3">메모: {order.memo}</p>}

                <div className="grid sm:grid-cols-2 gap-3 mb-4 p-3 bg-[#FAFAFA] rounded-md">
                  <div>
                    <Label className="text-xs">택배사</Label>
                    <Select
                      value={draft.courierCompany}
                      onValueChange={(v) => setDraft(order, { courierCompany: v })}
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
                    <Label className="text-xs">송장번호</Label>
                    <Input
                      className="h-9 mt-1"
                      value={draft.trackingNumber}
                      onChange={(e) => setDraft(order, { trackingNumber: e.target.value })}
                      placeholder="송장번호 입력"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {STATUS_FLOW.map((next) => (
                    <Button
                      key={next}
                      type="button"
                      size="sm"
                      variant={status === next ? "default" : "outline"}
                      className={status === next ? "bg-[#E11936] hover:bg-[#B71C1C]" : ""}
                      disabled={updateMutation.isPending}
                      onClick={() =>
                        updateMutation.mutate({
                          id: order.id,
                          status: next,
                          courierCompany: draft.courierCompany,
                          trackingNumber: draft.trackingNumber,
                        })
                      }
                    >
                      {MALL_ORDER_STATUS_OPTIONS.find((o) => o.value === next)?.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-[#888]"
                    disabled={status === "cancelled" || updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ id: order.id, status: "cancelled" })}
                  >
                    취소 (재고복구)
                  </Button>
                </div>
                {order.stockRestored && (
                  <p className="text-xs text-green-700 mt-2">재고가 복구되었습니다.</p>
                )}
                {order.shippedAt && (
                  <p className="text-xs text-[#888] mt-2">
                    인계일: {new Date(order.shippedAt).toLocaleString("ko-KR")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      </AdminPageShell>
    </AdminLayout>
  );
}
