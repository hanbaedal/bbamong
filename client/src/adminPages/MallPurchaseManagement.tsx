import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ClipboardList, Package, Truck } from "lucide-react";
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
  MALL_PURCHASE_STATUS_OPTIONS,
  type MallPurchaseOrderStatus,
} from "@shared/mallOps";

interface Supplier {
  id: number;
  name: string;
  phone: string;
}

interface ProductOption {
  id: number;
  name: string;
}

interface PurchaseLine {
  productName: string;
  color: string;
  size: string;
  quantity: number;
  receivedQuantity: number;
}

interface PurchaseOrder {
  id: number;
  supplierName: string;
  status: string;
  lines: PurchaseLine[];
  createdAt: string;
}

interface ReorderAlert {
  productId: number;
  name: string;
  color: string;
  size: string;
  stock: number;
  reorderPoint: number;
}

interface PurchaseData {
  suppliers?: Supplier[];
  products?: ProductOption[];
  orders?: PurchaseOrder[];
  reorderAlerts?: ReorderAlert[];
}

type StatusFilter = "all" | MallPurchaseOrderStatus;

const STATUS_BADGE: Record<MallPurchaseOrderStatus, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  ordered: "bg-blue-50 text-blue-800 border-blue-200",
  partial: "bg-amber-50 text-amber-800 border-amber-200",
  received: "bg-green-50 text-green-800 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

function statusLabel(status: string) {
  return MALL_PURCHASE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function AdminSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[10px] border border-[#E9E9E9] bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#F0F0F0] bg-[#FAFAFA]">
        <h2 className="text-sm font-semibold text-[#201E22]">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  active,
  accent,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  accent?: boolean;
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

function PurchaseStatusBadge({ status }: { status: string }) {
  const normalized = (MALL_PURCHASE_STATUS_OPTIONS.some((o) => o.value === status)
    ? status
    : "draft") as MallPurchaseOrderStatus;
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_BADGE[normalized]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function OrderDetailPanel({
  order,
  onReceive,
  onConfirmOrder,
  isPending,
}: {
  order: PurchaseOrder;
  onReceive: (orderId: number, lineIndex: number, qty: number) => void;
  onConfirmOrder: (id: number) => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-3">
      {order.lines.map((line, idx) => {
        const remain = line.quantity - (line.receivedQuantity ?? 0);
        const progress = line.quantity > 0 ? Math.round((line.receivedQuantity / line.quantity) * 100) : 0;
        return (
          <div
            key={idx}
            className="rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-3 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#201E22]">{line.productName}</p>
              <p className="text-xs text-[#888] mt-0.5">
                {[line.color, line.size].filter(Boolean).join(" / ") || "옵션 없음"}
              </p>
              <p className="text-xs text-[#666] mt-1 tabular-nums">
                입고 {line.receivedQuantity} / {line.quantity} ({progress}%)
              </p>
            </div>
            {remain > 0 && order.status !== "cancelled" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => onReceive(order.id, idx, remain)}
              >
                입고 {remain}개
              </Button>
            )}
          </div>
        );
      })}
      {order.status === "draft" && (
        <Button
          type="button"
          size="sm"
          className="bg-[#E11936] hover:bg-[#B71C1C]"
          disabled={isPending}
          onClick={() => onConfirmOrder(order.id)}
        >
          발주 확정
        </Button>
      )}
    </div>
  );
}

export default function MallPurchaseManagementPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", contactName: "" });
  const [poForm, setPoForm] = useState({
    supplierId: "",
    productId: "",
    productName: "",
    color: "",
    size: "",
    quantity: "1",
    unitCost: "0",
  });

  const { data, isLoading } = useQuery<PurchaseData>({
    queryKey: ["/api/admin/mall/purchase"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/admin/mall/purchase"), { credentials: "include" });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const supplierMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(getFullUrl("/api/admin/mall/purchase/suppliers"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierForm),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => {
      setSupplierForm({ name: "", phone: "", contactName: "" });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/mall/purchase"] });
    },
  });

  const poMutation = useMutation({
    mutationFn: async (status: "draft" | "ordered") => {
      const product = (data?.products ?? []).find((p) => p.id === parseInt(poForm.productId, 10));
      const res = await fetch(getFullUrl("/api/admin/mall/purchase/orders"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: parseInt(poForm.supplierId, 10),
          status,
          lines: [
            {
              productId: parseInt(poForm.productId, 10),
              productName: poForm.productName || product?.name || "상품",
              color: poForm.color,
              size: poForm.size,
              quantity: parseInt(poForm.quantity, 10),
              unitCost: parseInt(poForm.unitCost, 10) || 0,
            },
          ],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/mall/purchase"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(getFullUrl(`/api/admin/mall/purchase/orders/${id}/status`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["/api/admin/mall/purchase"] }),
  });

  const receiveMutation = useMutation({
    mutationFn: async ({
      orderId,
      lineIndex,
      quantity,
      warehouseId,
    }: {
      orderId: number;
      lineIndex: number;
      quantity: number;
      warehouseId: number;
    }) => {
      const res = await fetch(getFullUrl(`/api/admin/mall/purchase/orders/${orderId}/receive`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineIndex, quantity, warehouseId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/mall/purchase"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/mall/inventory/summary"] });
    },
  });

  const orders = data?.orders ?? [];
  const suppliers = data?.suppliers ?? [];
  const reorderAlerts = data?.reorderAlerts ?? [];

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: orders.length,
      draft: 0,
      ordered: 0,
      partial: 0,
      received: 0,
      cancelled: 0,
    };
    for (const order of orders) {
      const key = order.status as MallPurchaseOrderStatus;
      if (key in counts && key !== "all") counts[key] += 1;
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (filter === "all") return orders;
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  const handleReceive = async (orderId: number, lineIndex: number, qty: number) => {
    const inv = await fetch(getFullUrl("/api/admin/mall/inventory/summary"), { credentials: "include" });
    const invData = await inv.json();
    const whId = invData?.warehouses?.[0]?.id;
    if (!whId) return;
    receiveMutation.mutate({ orderId, lineIndex, quantity: qty, warehouseId: whId });
  };

  const isPending =
    supplierMutation.isPending ||
    poMutation.isPending ||
    statusMutation.isPending ||
    receiveMutation.isPending;

  const linesSummary = (lines: PurchaseLine[]) => {
    if (lines.length === 0) return "-";
    const first = lines[0].productName;
    if (lines.length === 1) return `${first} × ${lines[0].quantity}`;
    return `${first} 외 ${lines.length - 1}건`;
  };

  return (
    <AdminLayout>
      <AdminPageShell title="구매 관리" description="매입처 발주 → 입고 시 재고 자동 증가">
        {isLoading ? (
          <div className="rounded-lg border border-[#E9E9E9] bg-white p-8 text-center">
            <p className="text-sm text-[#888]">불러오는 중...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5 lg:mb-6">
              <SummaryCard label="전체" value={statusCounts.all} active={filter === "all"} onClick={() => setFilter("all")} />
              {MALL_PURCHASE_STATUS_OPTIONS.map((opt) => (
                <SummaryCard
                  key={opt.value}
                  label={opt.label}
                  value={statusCounts[opt.value]}
                  accent={opt.value === "ordered" || opt.value === "partial"}
                  active={filter === opt.value}
                  onClick={() => setFilter(opt.value)}
                />
              ))}
            </div>

            {reorderAlerts.length > 0 && (
              <div className="mb-5 lg:mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-semibold text-red-900 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  리오더 포인트 이하 ({reorderAlerts.length})
                </p>
                <ul className="text-sm text-red-900/90 space-y-1">
                  {reorderAlerts.slice(0, 6).map((a, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-x-3">
                      <span>
                        #{a.productId} {a.name}{" "}
                        {[a.color, a.size].filter(Boolean).join(" / ")}
                      </span>
                      <span className="tabular-nums shrink-0">
                        {a.stock}개 (기준 {a.reorderPoint})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-5 lg:gap-6 mb-6 lg:mb-8">
              <AdminSection title="매입처 등록">
                <div className="space-y-2 mb-4">
                  <Input
                    className="h-9"
                    placeholder="매입처명"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  />
                  <Input
                    className="h-9"
                    placeholder="담당자"
                    value={supplierForm.contactName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                  />
                  <Input
                    className="h-9"
                    placeholder="전화"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  />
                  <Button
                    type="button"
                    className="w-full bg-[#E11936] hover:bg-[#B71C1C]"
                    disabled={!supplierForm.name.trim() || supplierMutation.isPending}
                    onClick={() => supplierMutation.mutate()}
                  >
                    등록
                  </Button>
                </div>
                {suppliers.length === 0 ? (
                  <p className="text-sm text-[#888] text-center py-2">등록된 매입처가 없습니다.</p>
                ) : (
                  <ul className="space-y-1.5 max-h-36 overflow-y-auto">
                    {suppliers.map((s) => (
                      <li
                        key={s.id}
                        className="flex justify-between gap-2 text-sm rounded-md border border-[#F0F0F0] bg-[#FAFAFA] px-2.5 py-1.5"
                      >
                        <span className="font-medium text-[#201E22]">{s.name}</span>
                        <span className="text-xs text-[#888] shrink-0">{s.phone || "—"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </AdminSection>

              <AdminSection title="발주 등록">
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-[#666]">매입처</Label>
                    <Select value={poForm.supplierId} onValueChange={(v) => setPoForm({ ...poForm, supplierId: v })}>
                      <SelectTrigger className="h-9 mt-1">
                        <SelectValue placeholder="매입처 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-[#666]">상품</Label>
                    <Select
                      value={poForm.productId}
                      onValueChange={(v) => {
                        const p = (data?.products ?? []).find((x) => String(x.id) === v);
                        setPoForm({ ...poForm, productId: v, productName: p?.name ?? "" });
                      }}
                    >
                      <SelectTrigger className="h-9 mt-1">
                        <SelectValue placeholder="상품 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {(data?.products ?? []).map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            #{p.id} {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      className="h-9"
                      placeholder="컬러"
                      value={poForm.color}
                      onChange={(e) => setPoForm({ ...poForm, color: e.target.value })}
                    />
                    <Input
                      className="h-9"
                      placeholder="사이즈"
                      value={poForm.size}
                      onChange={(e) => setPoForm({ ...poForm, size: e.target.value })}
                    />
                  </div>
                  <Input
                    className="h-9"
                    type="number"
                    placeholder="수량"
                    value={poForm.quantity}
                    onChange={(e) => setPoForm({ ...poForm, quantity: e.target.value })}
                  />
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={!poForm.supplierId || !poForm.productId || poMutation.isPending}
                      onClick={() => poMutation.mutate("draft")}
                    >
                      임시저장
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 bg-[#E11936] hover:bg-[#B71C1C]"
                      disabled={!poForm.supplierId || !poForm.productId || poMutation.isPending}
                      onClick={() => poMutation.mutate("ordered")}
                    >
                      발주
                    </Button>
                  </div>
                </div>
              </AdminSection>
            </div>

            <section className="rounded-[10px] border border-[#E9E9E9] bg-white overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[#F0F0F0] bg-[#FAFAFA]">
                <h2 className="text-sm font-semibold text-[#201E22] flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4 text-[#888]" />
                  발주 목록
                </h2>
                <span className="text-xs text-[#888] tabular-nums">{filteredOrders.length}건</span>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="p-10 text-center">
                  <Package className="mx-auto h-10 w-10 text-[#CCC] mb-3" />
                  <p className="text-sm text-[#888]">발주 내역이 없습니다.</p>
                </div>
              ) : (
                <>
                  <div className={`hidden lg:block ${adminTableWrapClass} border-0 rounded-none`}>
                    <table className={adminTableClass}>
                      <thead>
                        <tr className="border-b border-[#E9E9E9] text-left text-xs text-[#888]">
                          <th className="px-4 py-2.5 w-10" />
                          <th className="px-4 py-2.5 font-medium">발주</th>
                          <th className="px-4 py-2.5 font-medium">매입처</th>
                          <th className="px-4 py-2.5 font-medium">품목</th>
                          <th className="px-4 py-2.5 font-medium">상태</th>
                          <th className="px-4 py-2.5 font-medium text-right">입고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => {
                          const expanded = expandedId === order.id;
                          const totalQty = order.lines.reduce((s, l) => s + l.quantity, 0);
                          const receivedQty = order.lines.reduce((s, l) => s + (l.receivedQuantity ?? 0), 0);
                          return (
                            <Fragment key={order.id}>
                              <tr
                                className={`border-b border-[#F0F0F0] cursor-pointer hover:bg-[#FFFBFB] transition-colors ${
                                  expanded ? "bg-[#FFFBFB]" : ""
                                }`}
                                onClick={() => setExpandedId(expanded ? null : order.id)}
                              >
                                <td className="px-4 py-2.5 text-[#888]">
                                  <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                                </td>
                                <td className="px-4 py-2.5">
                                  <p className="font-semibold text-[#201E22]">#{order.id}</p>
                                  <p className="text-xs text-[#888] mt-0.5">
                                    {new Date(order.createdAt).toLocaleString("ko-KR", {
                                      month: "2-digit",
                                      day: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </td>
                                <td className="px-4 py-2.5 text-sm text-[#201E22]">{order.supplierName}</td>
                                <td className="px-4 py-2.5 text-sm text-[#666] max-w-[200px] truncate">
                                  {linesSummary(order.lines)}
                                </td>
                                <td className="px-4 py-2.5">
                                  <PurchaseStatusBadge status={order.status} />
                                </td>
                                <td className="px-4 py-2.5 text-sm text-right tabular-nums text-[#201E22]">
                                  {receivedQty}/{totalQty}
                                </td>
                              </tr>
                              {expanded && (
                                <tr className="bg-[#FAFAFA] border-b border-[#E9E9E9]">
                                  <td colSpan={6} className="px-4 py-4">
                                    <OrderDetailPanel
                                      order={order}
                                      onReceive={handleReceive}
                                      onConfirmOrder={(id) => statusMutation.mutate({ id, status: "ordered" })}
                                      isPending={isPending}
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

                  <div className="lg:hidden divide-y divide-[#F0F0F0]">
                    {filteredOrders.map((order) => {
                      const expanded = expandedId === order.id;
                      const totalQty = order.lines.reduce((s, l) => s + l.quantity, 0);
                      const receivedQty = order.lines.reduce((s, l) => s + (l.receivedQuantity ?? 0), 0);
                      return (
                        <article key={order.id}>
                          <button
                            type="button"
                            className="w-full text-left p-4"
                            onClick={() => setExpandedId(expanded ? null : order.id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-[#201E22]">#{order.id}</span>
                                  <PurchaseStatusBadge status={order.status} />
                                </div>
                                <p className="text-xs text-[#888] mt-1">{order.supplierName}</p>
                                <p className="text-sm text-[#666] mt-1 truncate">{linesSummary(order.lines)}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-semibold tabular-nums flex items-center gap-1 justify-end">
                                  <Truck className="h-3.5 w-3.5 text-[#888]" />
                                  {receivedQty}/{totalQty}
                                </p>
                                <ChevronDown
                                  className={`h-4 w-4 text-[#888] ml-auto mt-1 transition-transform ${
                                    expanded ? "rotate-180" : ""
                                  }`}
                                />
                              </div>
                            </div>
                          </button>
                          {expanded && (
                            <div className="px-4 pb-4 border-t border-[#F0F0F0]">
                              <OrderDetailPanel
                                order={order}
                                onReceive={handleReceive}
                                onConfirmOrder={(id) => statusMutation.mutate({ id, status: "ordered" })}
                                isPending={isPending}
                              />
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </AdminPageShell>
    </AdminLayout>
  );
}
