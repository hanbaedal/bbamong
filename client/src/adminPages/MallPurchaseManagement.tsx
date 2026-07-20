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
import { MALL_PURCHASE_STATUS_OPTIONS } from "@shared/mallOps";

export default function MallPurchaseManagementPage() {
  const queryClient = useQueryClient();
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

  const { data, isLoading } = useQuery({
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
      const product = (data?.products ?? []).find(
        (p: { id: number }) => p.id === parseInt(poForm.productId, 10),
      );
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

  const handleReceive = async (orderId: number, lineIndex: number, qty: number) => {
    const inv = await fetch(getFullUrl("/api/admin/mall/inventory/summary"), { credentials: "include" });
    const invData = await inv.json();
    const whId = invData?.warehouses?.[0]?.id;
    if (!whId) return;
    receiveMutation.mutate({ orderId, lineIndex, quantity: qty, warehouseId: whId });
  };

  return (
    <AdminLayout>
      <AdminPageShell title="구매 관리" description="매입처 발주 → 입고 시 재고 자동 증가">
      {isLoading ? (
        <p className="text-sm text-[#888]">불러오는 중...</p>
      ) : (
        <>
          {(data?.reorderAlerts ?? []).length > 0 && (
            <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-lg">
              <p className="text-sm font-medium text-red-900 mb-2">리오더 포인트 이하</p>
              <ul className="text-sm text-red-800 space-y-1">
                {data.reorderAlerts.map((a: { productId: number; name: string; color: string; size: string; stock: number; reorderPoint: number }, i: number) => (
                  <li key={i}>
                    #{a.productId} {a.name}{" "}
                    {[a.color, a.size].filter(Boolean).join(" / ")} — {a.stock}개 (기준 {a.reorderPoint})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
            <div className="border border-[#E9E9E9] rounded-lg p-4">
              <h2 className="font-medium mb-3">매입처 등록</h2>
              <div className="space-y-2">
                <Input
                  placeholder="매입처명"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                />
                <Input
                  placeholder="담당자"
                  value={supplierForm.contactName}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                />
                <Input
                  placeholder="전화"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                />
                <Button
                  type="button"
                  className="bg-[#E11936] hover:bg-[#B71C1C]"
                  onClick={() => supplierMutation.mutate()}
                >
                  등록
                </Button>
              </div>
              <ul className="mt-4 text-sm space-y-1">
                {(data?.suppliers ?? []).map((s: { id: number; name: string; phone: string }) => (
                  <li key={s.id}>
                    {s.name} {s.phone ? `· ${s.phone}` : ""}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-[#E9E9E9] rounded-lg p-4">
              <h2 className="font-medium mb-3">발주 등록</h2>
              <div className="space-y-2">
                <Select value={poForm.supplierId} onValueChange={(v) => setPoForm({ ...poForm, supplierId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="매입처" />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.suppliers ?? []).map((s: { id: number; name: string }) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={poForm.productId}
                  onValueChange={(v) => {
                    const p = (data?.products ?? []).find((x: { id: number }) => String(x.id) === v);
                    setPoForm({ ...poForm, productId: v, productName: p?.name ?? "" });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="상품" />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.products ?? []).map((p: { id: number; name: string }) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        #{p.id} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="컬러"
                    value={poForm.color}
                    onChange={(e) => setPoForm({ ...poForm, color: e.target.value })}
                  />
                  <Input
                    placeholder="사이즈"
                    value={poForm.size}
                    onChange={(e) => setPoForm({ ...poForm, size: e.target.value })}
                  />
                </div>
                <Input
                  type="number"
                  placeholder="수량"
                  value={poForm.quantity}
                  onChange={(e) => setPoForm({ ...poForm, quantity: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => poMutation.mutate("draft")}>
                    임시저장
                  </Button>
                  <Button
                    type="button"
                    className="bg-[#E11936] hover:bg-[#B71C1C]"
                    onClick={() => poMutation.mutate("ordered")}
                  >
                    발주
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <h2 className="font-medium mb-3">발주 목록</h2>
          <div className="space-y-4">
            {(data?.orders ?? []).map(
              (order: {
                id: number;
                supplierName: string;
                status: string;
                lines: Array<{
                  productName: string;
                  color: string;
                  size: string;
                  quantity: number;
                  receivedQuantity: number;
                }>;
                createdAt: string;
              }) => (
                <div key={order.id} className="border border-[#E9E9E9] rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <p className="font-medium">
                      발주 #{order.id} · {order.supplierName}
                    </p>
                    <span className="text-sm text-[#E11936]">
                      {MALL_PURCHASE_STATUS_OPTIONS.find((o) => o.value === order.status)?.label ??
                        order.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#888] mb-3">
                    {new Date(order.createdAt).toLocaleString("ko-KR")}
                  </p>
                  {order.lines.map((line, idx) => {
                    const remain = line.quantity - (line.receivedQuantity ?? 0);
                    return (
                      <div key={idx} className="text-sm mb-2 flex flex-wrap items-center gap-2">
                        <span>
                          {line.productName}{" "}
                          {[line.color, line.size].filter(Boolean).join(" / ")} — {line.receivedQuantity}/
                          {line.quantity}
                        </span>
                        {remain > 0 && order.status !== "cancelled" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleReceive(order.id, idx, remain)}
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
                      className="mt-2 bg-[#E11936] hover:bg-[#B71C1C]"
                      onClick={() => statusMutation.mutate({ id: order.id, status: "ordered" })}
                    >
                      발주 확정
                    </Button>
                  )}
                </div>
              ),
            )}
          </div>
        </>
      )}
      </AdminPageShell>
    </AdminLayout>
  );
}
