import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "./adminLayout";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { apiRequest } from "@/lib/adminQueryClient";
import { Button } from "@/components/ui/button";
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

interface AdMobAdUnit {
  displayName: string;
  adUnitId: string;
  adFormat: string;
  appId: string;
  platform: string;
}

interface AdMobAppConfig {
  androidInterstitialAdUnitId: string;
  iosInterstitialAdUnitId: string;
}

export default function VideosPage() {
  const { assets } = useAdminAssets();
  const queryClient = useQueryClient();
  const [saveMessage, setSaveMessage] = useState("");

  const { data: admobData, isLoading, error } = useQuery<AdMobReportData>({
    queryKey: ["/api/admin/admob/revenue-report"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/admob/revenue-report");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: adUnitsData, isLoading: adUnitsLoading } = useQuery<{
    configured: boolean;
    adUnits: AdMobAdUnit[];
    error?: string;
  }>({
    queryKey: ["/api/admin/admob/ad-units"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/admob/ad-units");
      return res.json();
    },
    enabled: admobData?.configured ?? false,
  });

  const { data: appConfig } = useQuery<AdMobAppConfig>({
    queryKey: ["/api/admin/admob/app-config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/admob/app-config");
      return res.json();
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (payload: AdMobAppConfig) =>
      apiRequest("PUT", "/api/admin/admob/app-config", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admob/app-config"] });
      setSaveMessage("앱 광고 단위가 저장되었습니다. 네이티브 앱은 재시작 후 반영됩니다.");
      setTimeout(() => setSaveMessage(""), 5000);
    },
  });

  function StatCard({
    title,
    subtitle,
    value,
    unit,
    isLoading: loading,
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
          {loading ? (
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

  const interstitialUnits =
    adUnitsData?.adUnits?.filter((u) =>
      u.adFormat?.toUpperCase().includes("INTERSTITIAL"),
    ) ?? [];

  const androidUnits = interstitialUnits.filter((u) => u.platform === "ANDROID");
  const iosUnits = interstitialUnits.filter((u) => u.platform === "IOS");

  const applyAdUnit = (platform: "android" | "ios", adUnitId: string) => {
    const payload: AdMobAppConfig = {
      androidInterstitialAdUnitId: appConfig?.androidInterstitialAdUnitId ?? "",
      iosInterstitialAdUnitId: appConfig?.iosInterstitialAdUnitId ?? "",
    };
    if (platform === "android") payload.androidInterstitialAdUnitId = adUnitId;
    else payload.iosInterstitialAdUnitId = adUnitId;
    saveConfigMutation.mutate(payload);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col h-screen">
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-6" data-testid="breadcrumb">
            <span className="text-sm text-[#BFBFBF]">수익 관리</span>
            <span className="text-sm text-[#BFBFBF]">&gt;</span>
            <span className="text-sm text-[#201E22]">동영상 광고 수익 현황</span>
          </div>

          <h1
            className="text-2xl font-semibold text-[#201E22] mb-6 flex items-center gap-2"
            data-testid="text-page-title"
          >
            <img src={assets.adListIcon} className="w-8 h-8" alt="icon" />
            동영상 광고 수익 현황
          </h1>

          {!isConfigured && !isLoading && (
            <div className="mb-6 p-4 bg-[#FFF3E0] border border-[#FF9800] rounded-lg">
              <p className="text-sm text-[#E65100] font-medium mb-2">
                AdMob API 자격 증명이 설정되지 않았습니다.
              </p>
              <p className="text-xs text-[#E65100]">
                Replit Secrets에 ADMOB_CLIENT_ID, ADMOB_CLIENT_SECRET, ADMOB_PUBLISHER_ID,
                ADMOB_REFRESH_TOKEN 을 등록하세요.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-[#FFEBEE] border border-[#E11936] rounded-lg">
              <p className="text-sm text-[#C62828]">데이터를 불러오는 중 오류가 발생했습니다.</p>
            </div>
          )}

          {saveMessage && (
            <div className="mb-6 p-4 bg-[#E8F5E9] border border-[#4CAF50] rounded-lg text-sm text-[#2E7D32]">
              {saveMessage}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
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
              value={
                dailyRevenueData.length > 0
                  ? Math.round(totalRevenue / dailyRevenueData.length).toLocaleString()
                  : "0"
              }
              unit="원"
              isLoading={isLoading}
            />
          </div>

          {isConfigured && (
            <div className="bg-white border border-[#E9E9E9] rounded-lg p-6 mb-10">
              <h3 className="text-base font-semibold text-[#201E22] mb-2">
                앱 전면 광고 단위 (예측 게임)
              </h3>
              <p className="text-xs text-[#888] mb-4">
                AdMob에서 가져온 INTERSTITIAL 광고 단위를 선택하면 앱이 서버 설정을 자동으로
                사용합니다. (앱 재시작 필요)
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#E9E9E9]">
                  <p className="text-xs font-medium text-[#666] mb-1">Android (현재)</p>
                  <p className="text-sm text-[#201E22] break-all font-mono">
                    {appConfig?.androidInterstitialAdUnitId || "미설정"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#E9E9E9]">
                  <p className="text-xs font-medium text-[#666] mb-1">iOS (현재)</p>
                  <p className="text-sm text-[#201E22] break-all font-mono">
                    {appConfig?.iosInterstitialAdUnitId || "미설정"}
                  </p>
                </div>
              </div>

              {adUnitsLoading ? (
                <p className="text-sm text-[#888]">광고 단위 불러오는 중...</p>
              ) : interstitialUnits.length === 0 ? (
                <p className="text-sm text-[#888]">
                  INTERSTITIAL 광고 단위가 없습니다. AdMob 콘솔에서 앱·광고 단위를 먼저 만드세요.
                </p>
              ) : (
                <div className="space-y-4">
                  {androidUnits.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-[#201E22] mb-2">Android</p>
                      <div className="space-y-2">
                        {androidUnits.map((unit) => (
                          <div
                            key={unit.adUnitId}
                            className="flex items-center justify-between gap-2 p-2 border border-[#E9E9E9] rounded"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{unit.displayName}</p>
                              <p className="text-xs text-[#888] font-mono truncate">{unit.adUnitId}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => applyAdUnit("android", unit.adUnitId)}
                              disabled={saveConfigMutation.isPending}
                            >
                              Android 적용
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {iosUnits.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-[#201E22] mb-2">iOS</p>
                      <div className="space-y-2">
                        {iosUnits.map((unit) => (
                          <div
                            key={unit.adUnitId}
                            className="flex items-center justify-between gap-2 p-2 border border-[#E9E9E9] rounded"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{unit.displayName}</p>
                              <p className="text-xs text-[#888] font-mono truncate">{unit.adUnitId}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => applyAdUnit("ios", unit.adUnitId)}
                              disabled={saveConfigMutation.isPending}
                            >
                              iOS 적용
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-[#E9E9E9] rounded-lg p-6 mb-10">
            <h3 className="text-base font-semibold text-[#201E22] mb-4">일별 광고 수익 (최근 30일)</h3>
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
                  <Bar dataKey="revenue" fill="#E11936" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white border border-[#E9E9E9] rounded-lg p-6">
            <h3 className="text-base font-semibold text-[#201E22] mb-4">AdMob API 연동 정보</h3>
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
              <p className="text-xs text-[#BFBFBF]">* 데이터는 5분마다 갱신됩니다.</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
