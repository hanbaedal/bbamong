import type { Express } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { createAdmobApiClient } from "../utils/admobClient";
import { appAdmobConfigStorage } from "../UserStorage/appAdmobConfigStorage";

interface ReportRow {
  dimensionValues?: {
    DATE?: { value: string };
  };
  metricValues?: {
    ESTIMATED_EARNINGS?: { microsValue: string };
    AD_REQUESTS?: { integerValue: string };
    IMPRESSIONS?: { integerValue: string };
  };
}

interface ReportResponseItem {
  header?: object;
  row?: ReportRow;
  footer?: { matchingRowCount: string };
}

const appConfigSchema = z.object({
  androidInterstitialAdUnitId: z.string().max(200).optional().default(""),
  iosInterstitialAdUnitId: z.string().max(200).optional().default(""),
});

export async function adminAdmobRoutes(app: Express): Promise<void> {
  app.get("/api/config/admob", async (_req, res) => {
    try {
      const config = await appAdmobConfigStorage.getPublicConfig();
      res.json(config);
    } catch (error) {
      console.error("Get public admob config error:", error);
      res.json({
        androidInterstitialAdUnitId: "",
        iosInterstitialAdUnitId: "",
      });
    }
  });

  app.get("/api/admin/admob/app-config", adminAuthMiddleware, async (_req, res) => {
    try {
      const config = await appAdmobConfigStorage.getConfig();
      res.json(config);
    } catch (error) {
      console.error("Get admob app config error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.put("/api/admin/admob/app-config", adminAuthMiddleware, async (req, res) => {
    try {
      const parsed = appConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const config = await appAdmobConfigStorage.updateConfig(parsed.data);
      res.json(config);
    } catch (error) {
      console.error("Update admob app config error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/admin/admob/ad-units", adminAuthMiddleware, async (_req, res) => {
    try {
      const client = await createAdmobApiClient();
      if (!client) {
        return res.status(200).json({
          configured: false,
          adUnits: [],
          error: "AdMob 자격 증명이 설정되지 않았습니다.",
        });
      }

      const { admob, accountName } = client;

      const [appsRes, unitsRes] = await Promise.all([
        admob.accounts.apps.list({ parent: accountName, pageSize: 50 }),
        admob.accounts.adUnits.list({ parent: accountName, pageSize: 200 }),
      ]);

      const platformByAppId = new Map<string, string>();
      for (const app of appsRes.data.apps ?? []) {
        if (app.appId) {
          platformByAppId.set(app.appId, app.platform ?? "UNKNOWN");
        }
      }

      const adUnits = (unitsRes.data.adUnits ?? []).map((unit) => ({
        displayName: unit.displayName ?? "",
        adUnitId: unit.adUnitId ?? "",
        adFormat: unit.adFormat ?? "",
        appId: unit.appId ?? "",
        platform: unit.appId ? platformByAppId.get(unit.appId) ?? "UNKNOWN" : "UNKNOWN",
      }));

      res.json({
        configured: true,
        adUnits,
      });
    } catch (error: any) {
      console.error("AdMob ad units list failed:", error);
      res.status(200).json({
        configured: false,
        adUnits: [],
        error: error.message || "광고 단위 조회 실패",
      });
    }
  });

  app.get("/api/admin/admob/revenue-report", adminAuthMiddleware, async (_req, res) => {
    try {
      const client = await createAdmobApiClient();
      if (!client) {
        return res.status(200).json({
          error: "AdMob 자격 증명이 설정되지 않았습니다.",
          configured: false,
          totalViews: 0,
          totalImpressions: 0,
          totalRevenue: 0,
          dailyRevenueData: [],
          currencyCode: "KRW",
        });
      }

      const { admob, accountName } = client;

      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      const reportSpec = {
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
        dimensions: ["DATE"],
        metrics: ["ESTIMATED_EARNINGS", "AD_REQUESTS", "IMPRESSIONS"],
        localizationSettings: {
          currencyCode: "KRW",
          languageCode: "ko-KR",
        },
      };

      const response = await admob.accounts.networkReport.generate({
        parent: accountName,
        requestBody: {
          reportSpec,
        },
      });

      let totalEarnings = 0;
      let totalAdRequests = 0;
      let totalImpressions = 0;
      const dailyData: { date: string; revenue: number }[] = [];

      const reportData = response.data as ReportResponseItem[] | ReportResponseItem | undefined;

      if (reportData) {
        const items = Array.isArray(reportData) ? reportData : [reportData];

        for (const item of items) {
          if (item.row) {
            const row = item.row;
            const dateValue = row.dimensionValues?.DATE?.value;
            const earningsMicros = row.metricValues?.ESTIMATED_EARNINGS?.microsValue;
            const adRequests = row.metricValues?.AD_REQUESTS?.integerValue;
            const impressions = row.metricValues?.IMPRESSIONS?.integerValue;

            const earnings = earningsMicros ? parseInt(earningsMicros) / 1000000 : 0;
            totalEarnings += earnings;
            totalAdRequests += adRequests ? parseInt(adRequests) : 0;
            totalImpressions += impressions ? parseInt(impressions) : 0;

            if (dateValue) {
              const formattedDate = `${dateValue.substring(4, 6)}/${dateValue.substring(6, 8)}`;
              dailyData.push({
                date: formattedDate,
                revenue: Math.round(earnings),
              });
            }
          }
        }
      }

      dailyData.sort((a, b) => a.date.localeCompare(b.date));

      res.json({
        configured: true,
        totalViews: totalAdRequests,
        totalImpressions,
        totalRevenue: Math.round(totalEarnings),
        dailyRevenueData: dailyData,
        currencyCode: "KRW",
      });
    } catch (error: any) {
      console.error("AdMob 리포트 조회 실패:", error);

      if (error.code === 403 || error.code === 401) {
        return res.status(200).json({
          error: "AdMob API 접근 권한이 없습니다. 자격 증명을 확인해주세요.",
          configured: false,
          totalViews: 0,
          totalImpressions: 0,
          totalRevenue: 0,
          dailyRevenueData: [],
          currencyCode: "KRW",
        });
      }

      res.status(200).json({
        error: `AdMob 리포트 조회에 실패했습니다: ${error.message}`,
        configured: false,
        totalViews: 0,
        totalImpressions: 0,
        totalRevenue: 0,
        dailyRevenueData: [],
        currencyCode: "KRW",
      });
    }
  });
}
