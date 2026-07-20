import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "./adminLayout";
import { getFullUrl } from "@/lib/adminQueryClient";
import { Button } from "@/components/ui/button";

interface MallOrderItem {
  productId: number;
  productName: string;
  priceAmount: number;
  quantity: number;
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
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "접수",
  confirmed: "확인",
  shipped: "배송",
  cancelled: "취소",
};

export default function MallOrderManagementPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/mall/orders"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/admin/mall/orders"), { credentials: "include" });
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ orders: MallOrder[] }>;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(getFullUrl(`/api/admin/mall/orders/${id}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("update failed");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/mall/orders"] });
    },
  });

  const orders = data?.orders ?? [];

  return (
    <AdminLayout>
      <h1 className="text-xl font-semibold text-[#201E22] mb-2">쇼핑몰 주문 관리</h1>
      <p className="text-sm text-[#666] mb-6">정회원 주문 접수 목록입니다.</p>

      {isLoading ? (
        <p className="text-sm text-[#888]">불러오는 중...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-[#888]">주문 내역이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="border border-[#E9E9E9] rounded-lg p-4">
              <div className="flex flex-wrap justify-between gap-2 mb-3">
                <div>
                  <p className="font-semibold text-[#201E22]">주문 #{order.id}</p>
                  <p className="text-xs text-[#888]">
                    {new Date(order.createdAt).toLocaleString("ko-KR")} · 회원 {order.userId}
                  </p>
                </div>
                <span className="text-sm font-medium text-[#E11936]">
                  {order.totalAmount.toLocaleString()}원
                </span>
              </div>
              <ul className="text-sm text-[#444] mb-3 space-y-1">
                {order.items.map((item) => (
                  <li key={item.productId}>
                    {item.productName} × {item.quantity} — {(item.priceAmount * item.quantity).toLocaleString()}원
                  </li>
                ))}
              </ul>
              <p className="text-sm text-[#666] mb-1">
                {order.customerName} · {order.customerPhone}
              </p>
              <p className="text-sm text-[#666] mb-3 whitespace-pre-wrap">{order.shippingAddress}</p>
              {order.memo && (
                <p className="text-xs text-[#888] mb-3">메모: {order.memo}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {(["pending", "confirmed", "shipped", "cancelled"] as const).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    size="sm"
                    variant={order.status === status ? "default" : "outline"}
                    className={order.status === status ? "bg-[#E11936] hover:bg-[#B71C1C]" : ""}
                    onClick={() => updateMutation.mutate({ id: order.id, status })}
                  >
                    {STATUS_LABEL[status]}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
