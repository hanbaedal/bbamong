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
import { RevenuePlatformTabs, type RevenuePlatform } from "./revenue/revenuePlatformUi";

interface AdMobReportData {
  configured: boolean;
  platform?: RevenuePlatform;
  totalViews: number;
  totalImpressions: number;
  totalRevenue: number;
  dailyRevenueData: { date: string; revenue: number }[];
  currencyCode: string;
  counts?: { ppamong: number; badminton9: number };
  appBreakdown?: { appId: string; displayName: string; platformKind: RevenuePlatform; revenue: number }[];
  error?: string;
}

interface AdMobAdUnit {
  displayName: string;
  adUnitId: string;
  adFormat: string;
  appId: string;
  platform: string;
}

interface AdMobApp {
  displayName: string;
  appId: string;
  platform: string;
}

interface AdmobProductionReadiness {
  androidAppIdSet: boolean;
  iosAppIdSet: boolean;
  androidInterstitialSet: boolean;
  iosInterstitialSet: boolean;
  androidRewardedSet: boolean;
  iosRewardedSet: boolean;
  androidBannerSet: boolean;
  iosBannerSet: boolean;
  usingTestIds: boolean;
  readyForAndroidProduction: boolean;
  readyForIosProduction: boolean;
}

interface AdMobAppConfig {
  androidAppId: string;
  iosAppId: string;
  androidInterstitialAdUnitId: string;
  iosInterstitialAdUnitId: string;
  androidRewardedAdUnitId: string;
  iosRewardedAdUnitId: string;
  androidBannerAdUnitId: string;
  iosBannerAdUnitId: string;
  readiness?: AdmobProductionReadiness;
}

type AdFormatKey = "INTERSTITIAL" | "REWARDED" | "BANNER";

const FORMAT_LABELS: Record<AdFormatKey, string> = {
  INTERSTITIAL: "전면 (예측 대기)",
  REWARDED: "리워드 (500P 보상)",
  BANNER: "배너",
};

const CONFIG_FIELD_BY_FORMAT: Record<
  AdFormatKey,
  { android: keyof AdMobAppConfig; ios: keyof AdMobAppConfig }
> = {
  INTERSTITIAL: {
    android: "androidInterstitialAdUnitId",
    ios: "iosInterstitialAdUnitId",
  },
  REWARDED: {
    android: "androidRewardedAdUnitId",
    ios: "iosRewardedAdUnitId",
  },
  BANNER: {
    android: "androidBannerAdUnitId",
    ios: "iosBannerAdUnitId",
  },
};

function matchesFormat(adFormat: string, key: AdFormatKey): boolean {
  const upper = adFormat.toUpperCase();
  if (key === "INTERSTITIAL") return upper.includes("INTERSTITIAL");
  if (key === "REWARDED") return upper.includes("REWARD");
  return upper.includes("BANNER");
}

function emptyConfig(): AdMobAppConfig {
  return {
    androidAppId: "",
    iosAppId: "",
    androidInterstitialAdUnitId: "",
    iosInterstitialAdUnitId: "",
    androidRewardedAdUnitId: "",
    iosRewardedAdUnitId: "",
    androidBannerAdUnitId: "",
    iosBannerAdUnitId: "",
  };
}

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

function ReadinessItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`text-sm ${ok ? "text-[#2E7D32]" : "text-[#C62828]"}`}>
      {ok ? "✓" : "✗"} {label}
    </li>
  );
}

function AdUnitPicker({
  title,
  formatKey,
  androidUnits,
  iosUnits,
  appConfig,
  onApply,
  pending,
}: {
  title: string;
  formatKey: AdFormatKey;
  androidUnits: AdMobAdUnit[];
  iosUnits: AdMobAdUnit[];
  appConfig: AdMobAppConfig | undefined;
  onApply: (platform: "android" | "ios", adUnitId: string) => void;
  pending: boolean;
}) {
  const fields = CONFIG_FIELD_BY_FORMAT[formatKey];
  const androidCurrent = (appConfig?.[fields.android] as string) || "미설정";
  const iosCurrent = (appConfig?.[fields.ios] as string) || "미설정";

  return (
    <div className="border border-[#E9E9E9] rounded-lg p-4">
      <h4 className="text-sm font-semibold text-[#201E22] mb-3">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#E9E9E9]">
          <p className="text-xs font-medium text-[#666] mb-1">Android (현재)</p>
          <p className="text-xs text-[#201E22] break-all font-mono">{androidCurrent}</p>
        </div>
        <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#E9E9E9]">
          <p className="text-xs font-medium text-[#666] mb-1">iOS (현재)</p>
          <p className="text-xs text-[#201E22] break-all font-mono">{iosCurrent}</p>
        </div>
      </div>

      {androidUnits.length === 0 && iosUnits.length === 0 ? (
        <p className="text-xs text-[#888]">
          {FORMAT_LABELS[formatKey]} 광고 단위가 AdMob에 없습니다. AdMob 콘솔에서 먼저 만드세요.
        </p>
      ) : (
        <div className="space-y-3">
          {androidUnits.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#666]">Android</p>
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
                    onClick={() => onApply("android", unit.adUnitId)}
                    disabled={pending}
                  >
                    적용
                  </Button>
                </div>
              ))}
            </div>
          )}
          {iosUnits.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#666]">iOS</p>
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
                    onClick={() => onApply("ios", unit.adUnitId)}
                    disabled={pending}
                  >
                    적용
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VideosPage() {
  const { assets } = useAdminAssets();
  const queryClient = useQueryClient();
  const [saveMessage, setSaveMessage] = useState("");
  const [platform, setPlatform] = useState<RevenuePlatform>("ppamong");

  const { data: admobData, isLoading, error } = useQuery<AdMobReportData>({
    queryKey: ["/api/admin/admob/revenue-report", platform],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/admob/revenue-report?platform=${platform}`);
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: adUnitsData, isLoading: adUnitsLoading } = useQuery<{
    configured: boolean;
    apps: AdMobApp[];
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
      setSaveMessage("AdMob 설정이 저장되었습니다. 네이티브 앱은 재시작 후 반영됩니다.");
      setTimeout(() => setSaveMessage(""), 5000);
    },
  });

  const baseConfig = (): AdMobAppConfig => ({
    ...emptyConfig(),
    ...appConfig,
  });

  const applyAppId = (platform: "android" | "ios", appId: string) => {
    const payload = baseConfig();
    if (platform === "android") payload.androidAppId = appId;
    else payload.iosAppId = appId;
    saveConfigMutation.mutate(payload);
  };

  const applyAdUnit = (formatKey: AdFormatKey, platform: "android" | "ios", adUnitId: string) => {
    const payload = baseConfig();
    const fields = CONFIG_FIELD_BY_FORMAT[formatKey];
    if (platform === "android") {
      (payload[fields.android] as string) = adUnitId;
    } else {
      (payload[fields.ios] as string) = adUnitId;
    }
    saveConfigMutation.mutate(payload);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSaveMessage("클립보드에 복사했습니다.");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch {
      setSaveMessage("복사에 실패했습니다. 직접 선택해 복사해 주세요.");
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  const isConfigured = admobData?.configured ?? false;
  const totalViews = admobData?.totalViews ?? 0;
  const totalRevenue = admobData?.totalRevenue ?? 0;
  const dailyRevenueData = admobData?.dailyRevenueData ?? [];
  const revenueCounts = admobData?.counts ?? { ppamong: 0, badminton9: 0 };
  const appBreakdown = admobData?.appBreakdown ?? [];
  const readiness = appConfig?.readiness;
  const adUnits = adUnitsData?.adUnits ?? [];
  const apps = adUnitsData?.apps ?? [];

  const filterUnits = (formatKey: AdFormatKey, platform: "ANDROID" | "IOS") =>
    adUnits.filter((u) => u.platform === platform && matchesFormat(u.adFormat, formatKey));

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

          <RevenuePlatformTabs
            platform={platform}
            counts={revenueCounts}
            onChange={setPlatform}
            ppamongSublabel="com.ppamong.app · AdMob 앱"
            badminton9Sublabel="레거시 앱 (bbanden 등)"
            countLabel="개 앱"
          />

          <p className="text-sm text-[#666] mb-4">
            현재 탭{" "}
            <span className="font-semibold text-[#201E22]">
              {platform === "ppamong" ? "빠몽" : "빠던9"}
            </span>
            {platform === "ppamong"
              ? " · 운영 의사결정은 이 탭 기준으로 확인하세요."
              : " · 레거시 AdMob 앱 수익 참고용입니다."}
          </p>

          {!isConfigured && !isLoading && (
            <div className="mb-6 p-4 bg-[#FFF3E0] border border-[#FF9800] rounded-lg">
              <p className="text-sm text-[#E65100] font-medium mb-2">
                AdMob API 자격 증명이 설정되지 않았습니다.
              </p>
              <p className="text-xs text-[#E65100]">
                Replit Secrets에 ADMOB_CLIENT_ID, ADMOB_CLIENT_SECRET, ADMOB_PUBLISHER_ID,
                ADMOB_REFRESH_TOKEN 을 등록한 뒤 npm run check:admob 로 확인하세요.
              </p>
            </div>
          )}

          {readiness && (
            <div
              className={`mb-6 p-4 rounded-lg border ${
                readiness.readyForAndroidProduction
                  ? "bg-[#E8F5E9] border-[#4CAF50]"
                  : "bg-[#FFF8E1] border-[#FFC107]"
              }`}
            >
              <p className="text-sm font-medium text-[#201E22] mb-2">운영(Play 출시 전) 준비 상태</p>
              <ul className="space-y-1 mb-3">
                <ReadinessItem ok={readiness.androidAppIdSet} label="Android App ID (Manifest용)" />
                <ReadinessItem ok={readiness.androidInterstitialSet} label="Android 전면 광고" />
                <ReadinessItem ok={readiness.androidRewardedSet} label="Android 리워드 광고 (500P)" />
                <ReadinessItem
                  ok={!readiness.usingTestIds}
                  label="테스트 ID 미사용 (실제 AdMob ID)"
                />
              </ul>
              {readiness.readyForAndroidProduction ? (
                <p className="text-xs text-[#2E7D32]">
                  Android 실운영 준비 완료. APK 빌드 시 android/admob.local.properties 에 App ID를
                  맞춰 두세요.
                </p>
              ) : (
                <p className="text-xs text-[#F57C00]">
                  아래에서 AdMob 앱·광고 단위를 선택하면 Play 출시 전에도 실제 광고·수익 운영이
                  가능합니다.
                </p>
              )}
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
              subtitle={`${platform === "ppamong" ? "빠몽" : "빠던9"} AdMob 요청 (최근 30일)`}
              value={totalViews.toLocaleString()}
              isLoading={isLoading}
            />
            <StatCard
              title="총 수익"
              subtitle={`${platform === "ppamong" ? "빠몽" : "빠던9"} 예상 수익 (최근 30일)`}
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
            <div className="bg-white border border-[#E9E9E9] rounded-lg p-6 mb-10 space-y-6">
              <div>
                <h3 className="text-base font-semibold text-[#201E22] mb-2">AdMob 앱 (App ID)</h3>
                <p className="text-xs text-[#888] mb-4">
                  App ID는 AndroidManifest에 1회 반영됩니다. 선택 후{" "}
                  <code className="text-[11px]">npm run admob:write-native</code> 로
                  admob.local.properties 를 생성하고 APK를 다시 빌드하세요.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#E9E9E9]">
                    <p className="text-xs font-medium text-[#666] mb-1">Android App ID (현재)</p>
                    <p className="text-xs text-[#201E22] break-all font-mono mb-2">
                      {appConfig?.androidAppId || "미설정"}
                    </p>
                    {appConfig?.androidAppId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copyText(appConfig.androidAppId)}
                      >
                        복사
                      </Button>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#E9E9E9]">
                    <p className="text-xs font-medium text-[#666] mb-1">iOS App ID (현재)</p>
                    <p className="text-xs text-[#201E22] break-all font-mono mb-2">
                      {appConfig?.iosAppId || "미설정"}
                    </p>
                    {appConfig?.iosAppId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copyText(appConfig.iosAppId)}
                      >
                        복사
                      </Button>
                    )}
                  </div>
                </div>

                {adUnitsLoading ? (
                  <p className="text-sm text-[#888]">AdMob 앱 목록 불러오는 중...</p>
                ) : apps.length === 0 ? (
                  <p className="text-sm text-[#888]">
                    AdMob에 등록된 앱이 없습니다. AdMob 콘솔에서 com.ppamong.app 으로 앱을
                    등록하세요.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {apps.map((app) => (
                      <div
                        key={app.appId}
                        className="flex items-center justify-between gap-2 p-2 border border-[#E9E9E9] rounded"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {app.displayName || app.platform} ({app.platform})
                          </p>
                          <p className="text-xs text-[#888] font-mono truncate">{app.appId}</p>
                        </div>
                        {app.platform === "ANDROID" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => applyAppId("android", app.appId)}
                            disabled={saveConfigMutation.isPending}
                          >
                            Android 적용
                          </Button>
                        )}
                        {app.platform === "IOS" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => applyAppId("ios", app.appId)}
                            disabled={saveConfigMutation.isPending}
                          >
                            iOS 적용
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-semibold text-[#201E22]">광고 단위 (앱 재시작 후 반영)</h3>
                {adUnitsLoading ? (
                  <p className="text-sm text-[#888]">광고 단위 불러오는 중...</p>
                ) : (
                  <>
                    <AdUnitPicker
                      title={FORMAT_LABELS.INTERSTITIAL}
                      formatKey="INTERSTITIAL"
                      androidUnits={filterUnits("INTERSTITIAL", "ANDROID")}
                      iosUnits={filterUnits("INTERSTITIAL", "IOS")}
                      appConfig={appConfig}
                      onApply={(platform, id) => applyAdUnit("INTERSTITIAL", platform, id)}
                      pending={saveConfigMutation.isPending}
                    />
                    <AdUnitPicker
                      title={FORMAT_LABELS.REWARDED}
                      formatKey="REWARDED"
                      androidUnits={filterUnits("REWARDED", "ANDROID")}
                      iosUnits={filterUnits("REWARDED", "IOS")}
                      appConfig={appConfig}
                      onApply={(platform, id) => applyAdUnit("REWARDED", platform, id)}
                      pending={saveConfigMutation.isPending}
                    />
                    <AdUnitPicker
                      title={FORMAT_LABELS.BANNER}
                      formatKey="BANNER"
                      androidUnits={filterUnits("BANNER", "ANDROID")}
                      iosUnits={filterUnits("BANNER", "IOS")}
                      appConfig={appConfig}
                      onApply={(platform, id) => applyAdUnit("BANNER", platform, id)}
                      pending={saveConfigMutation.isPending}
                    />
                  </>
                )}
              </div>
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
              <p className="text-xs text-[#BFBFBF]">* 수익 데이터는 5분마다 갱신됩니다.</p>
              <p className="text-xs text-[#BFBFBF]">
                * 광고 단위 ID는 서버에 저장되며 앱 재시작만으로 반영됩니다 (APK 재빌드 불필요).
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
