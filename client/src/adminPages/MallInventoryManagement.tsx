import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "./adminLayout";
import AdminPageShell from "./components/AdminPageShell";
import { getFullUrl } from "@/lib/adminQueryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MALL_STOCK_MOVEMENT_LABELS } from "@shared/mallOps";

interface StockRow {
  productId: number;
  name: string;
  color: string;
  size: string;
  stock: number;
  reorderPoint: number;
  optimalStock: number;
  fulfillmentType: string;
}

export default function MallInventoryManagementPage() {
  const queryClient = useQueryClient();
  const [receiveForm, setReceiveForm] = useState({
    productId: "",
    color: "",
    size: "",
    quantity: "1",
    memo: "",
  });
  const [locationCode, setLocationCode] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/mall/inventory/summary"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/admin/mall/inventory/summary"), { credentials: "include" });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(getFullUrl("/api/admin/mall/inventory/receive"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/mall/inventory/summary"] });
      setReceiveForm({ productId: "", color: "", size: "", quantity: "1", memo: "" });
    },
  });

  const locationMutation = useMutation({
    mutationFn: async (body: { warehouseId: number; code: string }) => {
      const res = await fetch(getFullUrl("/api/admin/mall/inventory/locations"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => {
      setLocationCode("");
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/mall/inventory/summary"] });
    },
  });

  const warehouse = data?.warehouses?.[0];
  const stock: StockRow[] = data?.stock ?? [];
  const lowStock = stock.filter(
    (s) => s.fulfillmentType !== "procure" && s.reorderPoint > 0 && s.stock >= 0 && s.stock <= s.reorderPoint,
  );

  return (
    <AdminLayout>
      <AdminPageShell
        title="재고 관리"
        description={`창고: ${warehouse?.name ?? "본사 창고"} · 입고 시 몰 판매 재고 자동 반영`}
      >
      {isLoading ? (
        <p className="text-sm text-[#888]">불러오는 중...</p>
      ) : (
        <>
          {lowStock.length > 0 && (
            <div className="mb-6 p-4 border border-amber-200 bg-amber-50 rounded-lg">
              <p className="text-sm font-medium text-amber-900 mb-2">리오더 필요 ({lowStock.length})</p>
              <ul className="text-sm text-amber-800 space-y-1">
                {lowStock.slice(0, 10).map((s, i) => (
                  <li key={i}>
                    {s.name}
                    {s.color || s.size ? ` (${[s.color, s.size].filter(Boolean).join(" / ")})` : ""} — 재고{" "}
                    {s.stock} / 리오더 {s.reorderPoint}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
            <div className="border border-[#E9E9E9] rounded-lg p-4">
              <h2 className="font-medium mb-3">수동 입고</h2>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">상품 ID</Label>
                  <Input
                    value={receiveForm.productId}
                    onChange={(e) => setReceiveForm({ ...receiveForm, productId: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">컬러</Label>
                    <Input
                      value={receiveForm.color}
                      onChange={(e) => setReceiveForm({ ...receiveForm, color: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">사이즈</Label>
                    <Input
                      value={receiveForm.size}
                      onChange={(e) => setReceiveForm({ ...receiveForm, size: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">수량</Label>
                  <Input
                    type="number"
                    min={1}
                    value={receiveForm.quantity}
                    onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  className="bg-[#E11936] hover:bg-[#B71C1C]"
                  disabled={!warehouse || receiveMutation.isPending}
                  onClick={() =>
                    receiveMutation.mutate({
                      warehouseId: warehouse!.id,
                      productId: parseInt(receiveForm.productId, 10),
                      color: receiveForm.color,
                      size: receiveForm.size,
                      quantity: parseInt(receiveForm.quantity, 10),
                      memo: receiveForm.memo || "수동 입고",
                    })
                  }
                >
                  입고
                </Button>
                {receiveMutation.isError && (
                  <p className="text-xs text-red-600">{(receiveMutation.error as Error).message}</p>
                )}
              </div>
            </div>

            <div className="border border-[#E9E9E9] rounded-lg p-4">
              <h2 className="font-medium mb-3">로케이션 추가</h2>
              <div className="flex gap-2">
                <Input
                  placeholder="예: A-01-02"
                  value={locationCode}
                  onChange={(e) => setLocationCode(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!warehouse || !locationCode.trim()}
                  onClick={() =>
                    locationMutation.mutate({ warehouseId: warehouse!.id, code: locationCode.trim() })
                  }
                >
                  추가
                </Button>
              </div>
              <ul className="mt-3 text-sm text-[#666] space-y-1 max-h-40 overflow-y-auto">
                {(data?.locations ?? []).map((loc: { id: number; code: string }) => (
                  <li key={loc.id}>{loc.code}</li>
                ))}
              </ul>
            </div>
          </div>

          <h2 className="font-medium mb-3">재고 현황</h2>
          <div className="border border-[#E9E9E9] rounded-lg overflow-x-auto mb-8">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-[#FAFAFA]">
                <tr>
                  <th className="text-left p-2">상품</th>
                  <th className="text-left p-2">옵션</th>
                  <th className="text-right p-2">재고</th>
                  <th className="text-right p-2">리오더</th>
                  <th className="text-right p-2">적정</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((s, i) => (
                  <tr key={i} className="border-t border-[#F0F0F0]">
                    <td className="p-2">
                      {s.name}
                      <span className="text-xs text-[#888] block">#{s.productId}</span>
                    </td>
                    <td className="p-2">{[s.color, s.size].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="p-2 text-right">{s.stock < 0 ? "무제한" : s.stock}</td>
                    <td className="p-2 text-right">{s.reorderPoint || "—"}</td>
                    <td className="p-2 text-right">{s.optimalStock || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="font-medium mb-3">최근 입출고 이력</h2>
          <ul className="text-sm space-y-2">
            {(data?.movements ?? []).map((m: { id: number; productName: string; quantity: number; movementType: string; createdAt: string; memo: string }) => (
              <li key={m.id} className="border border-[#F0F0F0] rounded p-2">
                {MALL_STOCK_MOVEMENT_LABELS[m.movementType as keyof typeof MALL_STOCK_MOVEMENT_LABELS] ?? m.movementType}{" "}
                · {m.productName} · {m.quantity > 0 ? "+" : ""}
                {m.quantity} · {new Date(m.createdAt).toLocaleString("ko-KR")}
                {m.memo ? ` · ${m.memo}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
      </AdminPageShell>
    </AdminLayout>
  );
}
