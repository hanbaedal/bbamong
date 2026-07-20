import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "./adminLayout";
import { getFullUrl } from "@/lib/adminQueryClient";
import { Button } from "@/components/ui/button";

interface SalesSummary {
  period: string;
  from: string;
  to: string;
  summary: { orderCount: number; totalQuantity: number; totalAmount: number };
  byProduct: Array<{ productId: number; productName: string; quantity: number; amount: number }>;
  byMember: Array<{ userId: string; userName: string; orderCount: number; quantity: number; amount: number }>;
}

export default function MallSalesManagementPage() {
  const [period, setPeriod] = useState<"day" | "month">("month");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/mall/sales/summary", period],
    queryFn: async () => {
      const res = await fetch(getFullUrl(`/api/admin/mall/sales/summary?period=${period}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<SalesSummary>;
    },
  });

  return (
    <AdminLayout>
      <h1 className="text-xl font-semibold text-[#201E22] mb-2">판매 관리</h1>
      <p className="text-sm text-[#666] mb-4">취소 제외 주문 기준 집계</p>

      <div className="flex gap-2 mb-6">
        <Button
          type="button"
          size="sm"
          variant={period === "day" ? "default" : "outline"}
          className={period === "day" ? "bg-[#E11936] hover:bg-[#B71C1C]" : ""}
          onClick={() => setPeriod("day")}
        >
          오늘
        </Button>
        <Button
          type="button"
          size="sm"
          variant={period === "month" ? "default" : "outline"}
          className={period === "month" ? "bg-[#E11936] hover:bg-[#B71C1C]" : ""}
          onClick={() => setPeriod("month")}
        >
          이번 달
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[#888]">불러오는 중...</p>
      ) : data ? (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <div className="border border-[#E9E9E9] rounded-lg p-4">
              <p className="text-xs text-[#888]">주문 건수</p>
              <p className="text-2xl font-bold text-[#201E22]">{data.summary.orderCount}</p>
            </div>
            <div className="border border-[#E9E9E9] rounded-lg p-4">
              <p className="text-xs text-[#888]">판매 수량</p>
              <p className="text-2xl font-bold text-[#201E22]">{data.summary.totalQuantity}</p>
            </div>
            <div className="border border-[#E9E9E9] rounded-lg p-4">
              <p className="text-xs text-[#888]">매출</p>
              <p className="text-2xl font-bold text-[#E11936]">
                {data.summary.totalAmount.toLocaleString()}원
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <h2 className="font-medium text-[#201E22] mb-3">제품별</h2>
              <div className="border border-[#E9E9E9] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#FAFAFA]">
                    <tr>
                      <th className="text-left p-2">상품</th>
                      <th className="text-right p-2">수량</th>
                      <th className="text-right p-2">매출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byProduct.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-[#888]">
                          데이터 없음
                        </td>
                      </tr>
                    ) : (
                      data.byProduct.map((row) => (
                        <tr key={`${row.productId}-${row.productName}`} className="border-t border-[#F0F0F0]">
                          <td className="p-2">{row.productName}</td>
                          <td className="p-2 text-right">{row.quantity}</td>
                          <td className="p-2 text-right">{row.amount.toLocaleString()}원</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="font-medium text-[#201E22] mb-3">회원별</h2>
              <div className="border border-[#E9E9E9] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#FAFAFA]">
                    <tr>
                      <th className="text-left p-2">회원</th>
                      <th className="text-right p-2">주문</th>
                      <th className="text-right p-2">매출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byMember.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-[#888]">
                          데이터 없음
                        </td>
                      </tr>
                    ) : (
                      data.byMember.map((row) => (
                        <tr key={row.userId} className="border-t border-[#F0F0F0]">
                          <td className="p-2">
                            {row.userName}
                            <span className="text-xs text-[#888] block">{row.userId}</span>
                          </td>
                          <td className="p-2 text-right">{row.orderCount}</td>
                          <td className="p-2 text-right">{row.amount.toLocaleString()}원</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </AdminLayout>
  );
}
