import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "./adminLayout";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { apiRequest } from "@/lib/adminQueryClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AdMobReportData {
  configured: boolean;
  totalViews: number;
  totalImpressions: number;
  totalRevenue: number;
  dailyRevenueData: { date: string; revenue: number }[];
  currencyCode: string;
  error?: string;
}

export default function VideosPage() {
  const { assets } = useAdminAssets();

  const { data: admobData, isLoading, error } = useQuery<AdMobReportData>({
    queryKey: ["/api/admin/admob/revenue-report"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/admob/revenue-report");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  function StatCard({
    title,
    subtitle,
    value,
    unit,
    isLoading,
  }: {
    title: string;
    subtitle: string;
    value: string | number;
    unit?: string;
    isLoading?: boolean;
  }) {
    return (
      <div className="bg-white border border-[#E9E9E9] rounded-lg p-6">
        <div className="mb-2">
          <p className="text-sm text-[#4D4B4E] mb-1">{title}</p>
          <p className="text-xs text-[#BFBFBF]">{subtitle}</p>
        </div>
        <div className="flex items-baseline gap-1">
          {isLoading ? (
            <div className="h-8 w-24 bg-[#E9E9E9] rounded animate-pulse" />
          ) : (
            <>
              <span className="text-3xl font-semibold text-[#201E22]">{value}</span>
              {unit && <span className="text-lg text-[#E11936]">{unit}</span>}
            </>
          )}
        </div>
      </div>
    );
  }

  const isConfigured = admobData?.configured ?? false;
  const totalViews = admobData?.totalViews ?? 0;
  const totalRevenue = admobData?.totalRevenue ?? 0;
  const dailyRevenueData = admobData?.dailyRevenueData ?? [];

  return (
    <AdminLayout>
      <div className="flex flex-col h-screen">
        <div className="flex-shrink-0">
          <div
            className="flex items-center gap-2 mb-6"
            data-testid="breadcrumb"
          >
            <span className="text-sm text-[#BFBFBF]">수익 관리</span>
            <span className="text-sm text-[#BFBFBF]">&gt;</span>
            <span className="text-sm text-[#201E22]">
              동영상 광고 수익 현황
            </span>
          </div>

          <h1
            className="text-2xl font-semibold text-[#201E22] mb-6 flex items-center gap-2"
            data-testid="text-page-title"
          >
            <img src={assets.adListIcon} className="w-8 h-8" alt="icon" />{" "}
            동영상 광고 수익 현황
          </h1>

          {!isConfigured && !isLoading && (
            <div className="mb-6 p-4 bg-[#FFF3E0] border border-[#FF9800] rounded-lg">
              <p className="text-sm text-[#E65100] font-medium mb-2">
                AdMob API 자격 증명이 설정되지 않았습니다.
              </p>
              <p className="text-xs text-[#E65100]">
                다음 4개의 환경 변수가 필요합니다:
              </p>
              <ul className="text-xs text-[#E65100] list-disc list-inside mt-1">
                <li>ADMOB_CLIENT_ID - Google Cloud OAuth 클라이언트 ID</li>
                <li>ADMOB_CLIENT_SECRET - Google Cloud OAuth 클라이언트 시크릿</li>
                <li>ADMOB_REFRESH_TOKEN - OAuth 인증 후 발급받은 리프레시 토큰</li>
                <li>ADMOB_PUBLISHER_ID - AdMob 퍼블리셔 ID (pub-XXXX 형식)</li>
              </ul>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-[#FFEBEE] border border-[#E11936] rounded-lg">
              <p className="text-sm text-[#C62828]">
                데이터를 불러오는 중 오류가 발생했습니다.
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-4 mb-10">
            <StatCard
              title="총 시청 횟수 / 요청수"
              subtitle="AdMob 광고 요청 수 (최근 30일)"
              value={totalViews.toLocaleString()}
              isLoading={isLoading}
            />
            <StatCard
              title="총 수익"
              subtitle="AdMob 예상 수익 (최근 30일)"
              value={totalRevenue.toLocaleString()}
              unit="원"
              isLoading={isLoading}
            />
            <StatCard
              title="일 평균 수익"
              subtitle="하루 평균 예상 수익"
              value={dailyRevenueData.length > 0 
                ? Math.round(totalRevenue / dailyRevenueData.length).toLocaleString() 
                : "0"}
              unit="원"
              isLoading={isLoading}
            />
          </div>

          <div className="bg-white border border-[#E9E9E9] rounded-lg p-6 mb-10">
            <h3 className="text-base font-semibold text-[#201E22] mb-4">
              일별 광고 수익 (최근 30일)
            </h3>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="h-8 w-32 bg-[#E9E9E9] rounded animate-pulse" />
              </div>
            ) : dailyRevenueData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-[#BFBFBF]">데이터가 없습니다.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E9E9E9" />
                  <XAxis dataKey="date" tick={{ fill: "#4D4B4E", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#4D4B4E", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#201E22",
                      border: "1px solid #FFFFFF",
                      borderRadius: "4px",
                      color: "#FFFFFF",
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()}원`, "수익"]}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#E11936"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white border border-[#E9E9E9] rounded-lg p-6">
            <h3 className="text-base font-semibold text-[#201E22] mb-4">
              AdMob API 연동 정보
            </h3>
            <div className="space-y-2 text-sm text-[#4D4B4E]">
              <p>
                <span className="font-medium">연동 상태:</span>{" "}
                {isLoading ? (
                  <span className="text-[#BFBFBF]">확인 중...</span>
                ) : isConfigured ? (
                  <span className="text-[#4CAF50]">연동됨</span>
                ) : (
                  <span className="text-[#E11936]">미연동</span>
                )}
              </p>
              <p className="text-xs text-[#BFBFBF]">
                * 데이터는 Google AdMob API에서 실시간으로 가져옵니다. (5분마다 갱신)
              </p>
              <p className="text-xs text-[#BFBFBF]">
                * 수익은 예상 수익(ESTIMATED_EARNINGS)이며, 실제 정산 금액과 다를 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
