import type { admob_v1 } from "googleapis";
import { PPAMONG_MANAGER_APP_ID, PPAMONG_USER_APP_ID } from "../../shared/appIdentity";
import type { AppAdmobConfig } from "../UserStorage/appAdmobConfigStorage";
import type { RevenuePlatform } from "./revenuePlatform";
import { trimAdMobId } from "@shared/admobConstants";

interface ReportRow {
  dimensionValues?: {
    DATE?: { value: string };
    APP?: { value: string };
  };
  metricValues?: {
    ESTIMATED_EARNINGS?: { microsValue: string };
    AD_REQUESTS?: { integerValue: string };
    IMPRESSIONS?: { integerValue: string };
  };
}

export interface AdmobAppMeta {
  appId: string;
  displayName: string;
  platform: string;
  packageName: string;
  platformKind: RevenuePlatform;
}

export interface AdmobRevenueReportResult {
  configured: true;
  platform: RevenuePlatform;
  totalViews: number;
  totalImpressions: number;
  totalRevenue: number;
  dailyRevenueData: { date: string; revenue: number }[];
  currencyCode: string;
  counts: { ppamong: number; badminton9: number };
  appBreakdown: { appId: string; displayName: string; platformKind: RevenuePlatform; revenue: number }[];
}

const LEGACY_PACKAGE_HINTS = [/bbanden/i, /ppadun9/i, /badminton/i, /baden/i];
const PPAMONG_PACKAGE_HINTS = [/ppamong/i, /com\.ppamong/];

function normalizePackage(app: admob_v1.Schema$App): string {
  const linked = app.linkedAppInfo;
  return (
    linked?.androidAppInfo?.packageName ??
    linked?.iosAppInfo?.bundleId ??
    app.manualAppInfo?.displayName ??
    ""
  );
}

export function classifyAdmobApp(
  app: admob_v1.Schema$App,
  config: AppAdmobConfig,
): RevenuePlatform {
  const appId = app.appId ?? "";
  const configuredIds = [config.androidAppId, config.iosAppId].map(trimAdMobId).filter(Boolean);
  if (configuredIds.includes(appId)) {
    return "ppamong";
  }

  const pkg = normalizePackage(app);
  const label = `${app.name ?? ""} ${app.linkedAppInfo?.displayName ?? ""} ${pkg}`.toLowerCase();

  if (pkg === PPAMONG_USER_APP_ID || pkg === PPAMONG_MANAGER_APP_ID) {
    return "ppamong";
  }
  if (PPAMONG_PACKAGE_HINTS.some((re) => re.test(label) || re.test(pkg))) {
    return "ppamong";
  }
  if (LEGACY_PACKAGE_HINTS.some((re) => re.test(label) || re.test(pkg))) {
    return "badminton9";
  }

  return "badminton9";
}

export async function listAdmobAppsWithPlatform(
  admob: admob_v1.Admob,
  accountName: string,
  config: AppAdmobConfig,
): Promise<AdmobAppMeta[]> {
  const appsRes = await admob.accounts.apps.list({ parent: accountName, pageSize: 50 });
  return (appsRes.data.apps ?? []).map((app) => {
    const appId = app.appId ?? "";
    const platformKind = classifyAdmobApp(app, config);
    return {
      appId,
      displayName:
        app.name ??
        app.linkedAppInfo?.displayName ??
        app.manualAppInfo?.displayName ??
        appId,
      platform: app.platform ?? "UNKNOWN",
      packageName: normalizePackage(app),
      platformKind,
    };
  });
}

export async function fetchAdmobRevenueReport(
  admob: admob_v1.Admob,
  accountName: string,
  config: AppAdmobConfig,
  platform: RevenuePlatform,
): Promise<AdmobRevenueReportResult> {
  const appMetas = await listAdmobAppsWithPlatform(admob, accountName, config);
  const appKindById = new Map(appMetas.map((a) => [a.appId, a.platformKind]));

  const ppamongCount = appMetas.filter((a) => a.platformKind === "ppamong").length;
  const badminton9Count = appMetas.filter((a) => a.platformKind === "badminton9").length;

  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const response = await admob.accounts.networkReport.generate({
    parent: accountName,
    requestBody: {
      reportSpec: {
        dateRange: {
          startDate: {
            year: thirtyDaysAgo.getFullYear(),
            month: thirtyDaysAgo.getMonth() + 1,
            day: thirtyDaysAgo.getDate(),
          },
          endDate: {
            year: today.getFullYear(),
            month: today.getMonth() + 1,
            day: today.getDate(),
          },
        },
        dimensions: ["DATE", "APP"],
        metrics: ["ESTIMATED_EARNINGS", "AD_REQUESTS", "IMPRESSIONS"],
        localizationSettings: {
          currencyCode: "KRW",
          languageCode: "ko-KR",
        },
      },
    },
  });

  let totalEarnings = 0;
  let totalAdRequests = 0;
  let totalImpressions = 0;
  const dailyMap = new Map<string, number>();
  const appRevenueMap = new Map<string, number>();

  const reportData = response.data as
    | { row?: ReportRow; header?: object; footer?: object }[]
    | { row?: ReportRow }
    | undefined;

  const items = Array.isArray(reportData) ? reportData : reportData ? [reportData] : [];

  for (const item of items) {
    if (!item.row) continue;
    const row = item.row;
    const appId = row.dimensionValues?.APP?.value ?? "";
    const appKind = appKindById.get(appId) ?? "badminton9";
    if (appKind !== platform) continue;

    const dateValue = row.dimensionValues?.DATE?.value;
    const earningsMicros = row.metricValues?.ESTIMATED_EARNINGS?.microsValue;
    const adRequests = row.metricValues?.AD_REQUESTS?.integerValue;
    const impressions = row.metricValues?.IMPRESSIONS?.integerValue;

    const earnings = earningsMicros ? Number.parseInt(earningsMicros, 10) / 1_000_000 : 0;
    totalEarnings += earnings;
    totalAdRequests += adRequests ? Number.parseInt(adRequests, 10) : 0;
    totalImpressions += impressions ? Number.parseInt(impressions, 10) : 0;

    if (appId) {
      appRevenueMap.set(appId, (appRevenueMap.get(appId) ?? 0) + earnings);
    }

    if (dateValue) {
      const formattedDate = `${dateValue.substring(4, 6)}/${dateValue.substring(6, 8)}`;
      dailyMap.set(formattedDate, (dailyMap.get(formattedDate) ?? 0) + earnings);
    }
  }

  const dailyRevenueData = Array.from(dailyMap.entries())
    .map(([date, revenue]) => ({ date, revenue: Math.round(revenue) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const appBreakdown = appMetas
    .filter((a) => a.platformKind === platform)
    .map((a) => ({
      appId: a.appId,
      displayName: a.displayName,
      platformKind: a.platformKind,
      revenue: Math.round((appRevenueMap.get(a.appId) ?? 0) * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    configured: true,
    platform,
    totalViews: totalAdRequests,
    totalImpressions,
    totalRevenue: Math.round(totalEarnings),
    dailyRevenueData,
    currencyCode: "KRW",
    counts: { ppamong: ppamongCount, badminton9: badminton9Count },
    appBreakdown,
  };
}
