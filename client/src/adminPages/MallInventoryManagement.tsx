import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Boxes, MapPin, PackagePlus, Warehouse } from "lucide-react";
import AdminLayout from "./adminLayout";
import AdminPageShell from "./components/AdminPageShell";
import { adminTableClass, adminTableWrapClass } from "./components/adminPageStyles";
import { getFullUrl } from "@/lib/adminQueryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MALL_STOCK_MOVEMENT_LABELS, type MallStockMovementType } from "@shared/mallOps";

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

interface InventoryLocation {
  id: number;
  code: string;
}

interface StockMovement {
  id: number;
  productName: string;
  quantity: number;
  movementType: string;
  createdAt: string;
  memo: string;
}

interface InventorySummary {
  warehouses?: Array<{ id: number; name: string }>;
  stock?: StockRow[];
  locations?: InventoryLocation[];
  movements?: StockMovement[];
}

function AdminSection({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[10px] border border-[#E9E9E9] bg-white overflow-hidden ${className}`}>
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
  sub,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  icon: typeof Boxes;
}) {
  return (
    <div className="rounded-lg border border-[#E9E9E9] bg-white px-4 py-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-[#888] truncate">{label}</p>
        <Icon className={`h-4 w-4 shrink-0 ${accent ? "text-[#E11936]" : "text-[#CCC]"}`} />
      </div>
      <p className={`text-xl lg:text-2xl font-bold mt-1 tabular-nums ${accent ? "text-[#E11936]" : "text-[#201E22]"}`}>
        {value}
      </p>
      {sub ? <p className="text-xs text-[#888] mt-0.5">{sub}</p> : null}
    </div>
  );
}

function stockStatus(s: StockRow) {
  if (s.stock < 0 || s.fulfillmentType === "procure") {
    return { label: "무제한", className: "bg-gray-100 text-gray-600 border-gray-200" };
  }
  if (s.reorderPoint > 0 && s.stock <= s.reorderPoint) {
    return { label: "리오더", className: "bg-amber-50 text-amber-800 border-amber-200" };
  }
  return { label: "정상", className: "bg-green-50 text-green-800 border-green-200" };
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

  const { data, isLoading } = useQuery<InventorySummary>({
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
  const stock = data?.stock ?? [];
  const locations = data?.locations ?? [];
  const movements = data?.movements ?? [];

  const lowStock = useMemo(
    () =>
      stock.filter(
        (s) => s.fulfillmentType !== "procure" && s.reorderPoint > 0 && s.stock >= 0 && s.stock <= s.reorderPoint,
      ),
    [stock],
  );

  const totalUnits = useMemo(
    () => stock.filter((s) => s.stock >= 0).reduce((sum, s) => sum + s.stock, 0),
    [stock],
  );

  return (
    <AdminLayout>
      <AdminPageShell
        title="재고 관리"
        description={`창고: ${warehouse?.name ?? "본사 창고"} · 입고 시 몰 판매 재고 자동 반영`}
      >
        {isLoading ? (
          <div className="rounded-lg border border-[#E9E9E9] bg-white p-8 text-center">
            <p className="text-sm text-[#888]">불러오는 중...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 lg:mb-6">
              <SummaryCard label="SKU" value={stock.length.toLocaleString()} sub="품목·옵션" icon={Boxes} />
              <SummaryCard
                label="리오더 필요"
                value={lowStock.length.toLocaleString()}
                sub="기준 이하"
                accent={lowStock.length > 0}
                icon={AlertTriangle}
              />
              <SummaryCard label="총 재고" value={totalUnits.toLocaleString()} sub="수량 합계" icon={Warehouse} />
              <SummaryCard label="로케이션" value={locations.length.toLocaleString()} sub="등록됨" icon={MapPin} />
            </div>

            {lowStock.length > 0 && (
              <div className="mb-5 lg:mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  리오더 필요 ({lowStock.length})
                </p>
                <ul className="text-sm text-amber-900/90 space-y-1">
                  {lowStock.slice(0, 8).map((s, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                      <span>
                        {s.name}
                        {s.color || s.size ? ` (${[s.color, s.size].filter(Boolean).join(" / ")})` : ""}
                      </span>
                      <span className="tabular-nums shrink-0">
                        {s.stock} / 기준 {s.reorderPoint}
                      </span>
                    </li>
                  ))}
                  {lowStock.length > 8 && (
                    <li className="text-xs text-amber-800 pt-1">외 {lowStock.length - 8}건</li>
                  )}
                </ul>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-5 lg:gap-6 mb-6 lg:mb-8">
              <AdminSection title="수동 입고">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-[#666]">상품 ID</Label>
                    <Input
                      className="mt-1 h-9"
                      value={receiveForm.productId}
                      onChange={(e) => setReceiveForm({ ...receiveForm, productId: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-[#666]">컬러</Label>
                      <Input
                        className="mt-1 h-9"
                        value={receiveForm.color}
                        onChange={(e) => setReceiveForm({ ...receiveForm, color: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[#666]">사이즈</Label>
                      <Input
                        className="mt-1 h-9"
                        value={receiveForm.size}
                        onChange={(e) => setReceiveForm({ ...receiveForm, size: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-[#666]">수량</Label>
                    <Input
                      className="mt-1 h-9"
                      type="number"
                      min={1}
                      value={receiveForm.quantity}
                      onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full bg-[#E11936] hover:bg-[#B71C1C]"
                    disabled={!warehouse || !receiveForm.productId.trim() || receiveMutation.isPending}
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
                    <PackagePlus className="h-4 w-4 mr-1.5" />
                    입고 처리
                  </Button>
                  {receiveMutation.isError && (
                    <p className="text-xs text-red-600">{(receiveMutation.error as Error).message}</p>
                  )}
                </div>
              </AdminSection>

              <AdminSection title="로케이션">
                <div className="flex gap-2 mb-3">
                  <Input
                    className="h-9"
                    placeholder="예: A-01-02"
                    value={locationCode}
                    onChange={(e) => setLocationCode(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={!warehouse || !locationCode.trim() || locationMutation.isPending}
                    onClick={() =>
                      locationMutation.mutate({ warehouseId: warehouse!.id, code: locationCode.trim() })
                    }
                  >
                    추가
                  </Button>
                </div>
                {locations.length === 0 ? (
                  <p className="text-sm text-[#888] text-center py-4">등록된 로케이션이 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {locations.map((loc) => (
                      <span
                        key={loc.id}
                        className="inline-flex items-center rounded-md border border-[#E9E9E9] bg-[#FAFAFA] px-2 py-1 text-xs font-medium text-[#444]"
                      >
                        {loc.code}
                      </span>
                    ))}
                  </div>
                )}
              </AdminSection>
            </div>

            <AdminSection title="재고 현황" className="mb-6 lg:mb-8">
              {stock.length === 0 ? (
                <p className="text-sm text-[#888] text-center py-8">재고 데이터가 없습니다.</p>
              ) : (
                <div className={`${adminTableWrapClass} border-0 rounded-none`}>
                  <table className={adminTableClass}>
                    <thead>
                      <tr className="border-b border-[#E9E9E9] text-left text-xs text-[#888]">
                        <th className="px-4 py-2.5 font-medium">상품</th>
                        <th className="px-4 py-2.5 font-medium">옵션</th>
                        <th className="px-4 py-2.5 font-medium text-right">재고</th>
                        <th className="px-4 py-2.5 font-medium text-right">리오더</th>
                        <th className="px-4 py-2.5 font-medium text-right">적정</th>
                        <th className="px-4 py-2.5 font-medium">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stock.map((s, i) => {
                        const status = stockStatus(s);
                        return (
                          <tr key={i} className="border-b border-[#F0F0F0] hover:bg-[#FFFBFB] transition-colors">
                            <td className="px-4 py-2.5">
                              <p className="text-sm font-medium text-[#201E22]">{s.name}</p>
                              <p className="text-xs text-[#888]">#{s.productId}</p>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-[#666]">
                              {[s.color, s.size].filter(Boolean).join(" / ") || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-right font-semibold tabular-nums">
                              {s.stock < 0 ? "무제한" : s.stock.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-right tabular-nums text-[#666]">
                              {s.reorderPoint || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-right tabular-nums text-[#666]">
                              {s.optimalStock || "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}
                              >
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminSection>

            <AdminSection title="최근 입출고 이력">
              {movements.length === 0 ? (
                <p className="text-sm text-[#888] text-center py-8">이력이 없습니다.</p>
              ) : (
                <div className={`${adminTableWrapClass} border-0 rounded-none`}>
                  <table className={adminTableClass}>
                    <thead>
                      <tr className="border-b border-[#E9E9E9] text-left text-xs text-[#888]">
                        <th className="px-4 py-2.5 font-medium">일시</th>
                        <th className="px-4 py-2.5 font-medium">유형</th>
                        <th className="px-4 py-2.5 font-medium">상품</th>
                        <th className="px-4 py-2.5 font-medium text-right">수량</th>
                        <th className="px-4 py-2.5 font-medium">메모</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id} className="border-b border-[#F0F0F0] hover:bg-[#FFFBFB]">
                          <td className="px-4 py-2.5 text-xs text-[#888] whitespace-nowrap">
                            {new Date(m.createdAt).toLocaleString("ko-KR", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-2.5 text-sm">
                            {MALL_STOCK_MOVEMENT_LABELS[m.movementType as MallStockMovementType] ?? m.movementType}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-[#201E22]">{m.productName}</td>
                          <td
                            className={`px-4 py-2.5 text-sm text-right font-semibold tabular-nums ${
                              m.quantity > 0 ? "text-green-700" : "text-[#E11936]"
                            }`}
                          >
                            {m.quantity > 0 ? "+" : ""}
                            {m.quantity}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-[#888] max-w-[160px] truncate">
                            {m.memo || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminSection>
          </>
        )}
      </AdminPageShell>
    </AdminLayout>
  );
}
