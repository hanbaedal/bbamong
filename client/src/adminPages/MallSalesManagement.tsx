import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ShoppingBag, TrendingUp, Users } from "lucide-react";
import AdminLayout from "./adminLayout";
import AdminPageShell from "./components/AdminPageShell";
import { adminTableClass } from "./components/adminPageStyles";
import { getFullUrl } from "@/lib/adminQueryClient";

interface SalesSummary {
  period: string;
  from: string;
  to: string;
  summary: { orderCount: number; totalQuantity: number; totalAmount: number };
  byProduct: Array<{ productId: number; productName: string; quantity: number; amount: number }>;
  byMember: Array<{ userId: string; userName: string; orderCount: number; quantity: number; amount: number }>;
}

type Period = "day" | "month";

function formatPeriodLabel(from: string, to: string, period: Period) {
  const start = new Date(from);
  const end = new Date(to);
  if (period === "day") {
    return start.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return start.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  }
  return `${start.toLocaleDateString("ko-KR")} ~ ${end.toLocaleDateString("ko-KR")}`;
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
  icon: typeof ShoppingBag;
}) {
  return (
    <div className="rounded-lg border border-[#E9E9E9] bg-white px-4 py-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-[#888] truncate">{label}</p>
        <Icon className={`h-4 w-4 shrink-0 ${accent ? "text-[#E11936]" : "text-[#CCC]"}`} />
      </div>
      <p
        className={`text-xl lg:text-2xl font-bold mt-1 tabular-nums truncate ${
          accent ? "text-[#E11936]" : "text-[#201E22]"
        }`}
      >
        {value}
      </p>
      {sub ? <p className="text-xs text-[#888] mt-0.5">{sub}</p> : null}
    </div>
  );
}

function PeriodToggle({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-5 lg:mb-6 max-w-md">
      {(
        [
          { id: "day" as const, label: "오늘" },
          { id: "month" as const, label: "이번 달" },
        ] as const
      ).map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-lg border px-4 py-3 text-left transition-colors ${
            period === id
              ? "border-[#E11936] bg-[#FFF5F6] ring-1 ring-[#E11936]/20"
              : "border-[#E9E9E9] bg-white hover:border-[#D0D0D0]"
          }`}
        >
          <p className="text-sm font-semibold text-[#201E22]">{label}</p>
          <p className="text-xs text-[#888] mt-0.5">
            {id === "day" ? "당일 집계" : "월간 집계"}
          </p>
        </button>
      ))}
    </div>
  );
}

function SalesSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-[#E9E9E9] bg-white overflow-hidden min-w-0">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[#F0F0F0] bg-[#FAFAFA]">
        <h2 className="text-sm font-semibold text-[#201E22]">{title}</h2>
        <span className="text-xs text-[#888] tabular-nums">{count}건</span>
      </div>
      <div className="p-0">{children}</div>
    </section>
  );
}

function EmptyTableRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-[#888]">
        {message}
      </td>
    </tr>
  );
}

function sharePercent(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default function MallSalesManagementPage() {
  const [period, setPeriod] = useState<Period>("month");

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

  const avgOrderAmount = useMemo(() => {
    if (!data || data.summary.orderCount === 0) return 0;
    return Math.round(data.summary.totalAmount / data.summary.orderCount);
  }, [data]);

  const sortedProducts = useMemo(
    () => [...(data?.byProduct ?? [])].sort((a, b) => b.amount - a.amount),
    [data?.byProduct],
  );

  const sortedMembers = useMemo(
    () => [...(data?.byMember ?? [])].sort((a, b) => b.amount - a.amount),
    [data?.byMember],
  );

  return (
    <AdminLayout>
      <AdminPageShell title="판매 관리" description="취소 제외 주문 기준 집계">
        <PeriodToggle period={period} onChange={setPeriod} />

        {isLoading ? (
          <div className="rounded-lg border border-[#E9E9E9] bg-white p-8 text-center">
            <p className="text-sm text-[#888]">불러오는 중...</p>
          </div>
        ) : data ? (
          <>
            <p className="text-sm text-[#666] mb-4">
              집계 기간:{" "}
              <span className="font-medium text-[#201E22]">
                {formatPeriodLabel(data.from, data.to, period)}
              </span>
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 lg:mb-8">
              <SummaryCard
                label="주문 건수"
                value={data.summary.orderCount.toLocaleString()}
                sub="건"
                icon={ShoppingBag}
              />
              <SummaryCard
                label="판매 수량"
                value={data.summary.totalQuantity.toLocaleString()}
                sub="개"
                icon={BarChart3}
              />
              <SummaryCard
                label="매출"
                value={`${data.summary.totalAmount.toLocaleString()}원`}
                accent
                icon={TrendingUp}
              />
              <SummaryCard
                label="객단가"
                value={`${avgOrderAmount.toLocaleString()}원`}
                sub="주문당 평균"
                icon={Users}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-5 lg:gap-6">
              <SalesSection title="제품별 매출" count={sortedProducts.length}>
                <div className="overflow-x-auto w-full">
                  <table className={adminTableClass}>
                    <thead>
                      <tr className="border-b border-[#E9E9E9] text-left text-xs text-[#888] bg-white">
                        <th className="px-4 py-2.5 font-medium w-10">#</th>
                        <th className="px-4 py-2.5 font-medium">상품</th>
                        <th className="px-4 py-2.5 font-medium text-right">수량</th>
                        <th className="px-4 py-2.5 font-medium text-right">매출</th>
                        <th className="px-4 py-2.5 font-medium text-right w-16">비중</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProducts.length === 0 ? (
                        <EmptyTableRow colSpan={5} message="판매 데이터가 없습니다." />
                      ) : (
                        sortedProducts.map((row, idx) => (
                          <tr
                            key={`${row.productId}-${row.productName}`}
                            className="border-b border-[#F0F0F0] hover:bg-[#FFFBFB] transition-colors"
                          >
                            <td className="px-4 py-2.5 text-xs text-[#888] tabular-nums">{idx + 1}</td>
                            <td className="px-4 py-2.5 text-sm text-[#201E22] font-medium max-w-[180px] truncate">
                              {row.productName}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-right tabular-nums">
                              {row.quantity.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-right font-semibold tabular-nums text-[#201E22]">
                              {row.amount.toLocaleString()}원
                            </td>
                            <td className="px-4 py-2.5 text-xs text-right text-[#888] tabular-nums">
                              {sharePercent(row.amount, data.summary.totalAmount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SalesSection>

              <SalesSection title="회원별 매출" count={sortedMembers.length}>
                <div className="overflow-x-auto w-full">
                  <table className={adminTableClass}>
                    <thead>
                      <tr className="border-b border-[#E9E9E9] text-left text-xs text-[#888] bg-white">
                        <th className="px-4 py-2.5 font-medium w-10">#</th>
                        <th className="px-4 py-2.5 font-medium">회원</th>
                        <th className="px-4 py-2.5 font-medium text-right">주문</th>
                        <th className="px-4 py-2.5 font-medium text-right">수량</th>
                        <th className="px-4 py-2.5 font-medium text-right">매출</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMembers.length === 0 ? (
                        <EmptyTableRow colSpan={5} message="회원별 데이터가 없습니다." />
                      ) : (
                        sortedMembers.map((row, idx) => (
                          <tr
                            key={row.userId}
                            className="border-b border-[#F0F0F0] hover:bg-[#FFFBFB] transition-colors"
                          >
                            <td className="px-4 py-2.5 text-xs text-[#888] tabular-nums">{idx + 1}</td>
                            <td className="px-4 py-2.5 min-w-0">
                              <p className="text-sm font-medium text-[#201E22] truncate">{row.userName}</p>
                              <p className="text-xs text-[#888] truncate">{row.userId}</p>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-right tabular-nums">
                              {row.orderCount.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-right tabular-nums">
                              {row.quantity.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-right font-semibold tabular-nums text-[#201E22]">
                              {row.amount.toLocaleString()}원
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SalesSection>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-[#E0E0E0] bg-[#FAFAFA] p-10 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-[#CCC] mb-3" />
            <p className="text-sm text-[#888]">집계 데이터를 불러올 수 없습니다.</p>
          </div>
        )}
      </AdminPageShell>
    </AdminLayout>
  );
}
