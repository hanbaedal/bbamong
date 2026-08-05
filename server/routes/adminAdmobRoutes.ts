import type { Express } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { createAdmobApiClient } from "../utils/admobClient";
import {
  appAdmobConfigStorage,
  evaluateAdmobProductionReadiness,
} from "../UserStorage/appAdmobConfigStorage";
import { fetchAdmobRevenueReport } from "../utils/admobRevenueReport";
import type { RevenuePlatform } from "../utils/revenuePlatform";

const optionalAdMobId = z.string().max(200).optional().default("");

const appConfigSchema = z.object({
  androidAppId: optionalAdMobId,
  iosAppId: optionalAdMobId,
  androidInterstitialAdUnitId: optionalAdMobId,
  iosInterstitialAdUnitId: optionalAdMobId,
  androidRewardedAdUnitId: optionalAdMobId,
  iosRewardedAdUnitId: optionalAdMobId,
  androidBannerAdUnitId: optionalAdMobId,
  iosBannerAdUnitId: optionalAdMobId,
});

export async function adminAdmobRoutes(app: Express): Promise<void> {
  app.get("/api/config/admob", async (_req, res) => {
    try {
      const config = await appAdmobConfigStorage.getPublicConfig();
      res.json(config);
    } catch (error) {
      console.error("Get public admob config error:", error);
      res.json({
        androidAppId: "",
        iosAppId: "",
        androidInterstitialAdUnitId: "",
        iosInterstitialAdUnitId: "",
        androidRewardedAdUnitId: "",
        iosRewardedAdUnitId: "",
        androidBannerAdUnitId: "",
        iosBannerAdUnitId: "",
      });
    }
  });

  app.get("/api/admin/admob/app-config", adminAuthMiddleware, async (_req, res) => {
    try {
      const config = await appAdmobConfigStorage.getConfig();
      res.json({
        ...config,
        readiness: evaluateAdmobProductionReadiness(config),
      });
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
      res.json({
        ...config,
        readiness: evaluateAdmobProductionReadiness(config),
      });
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
          apps: [],
          adUnits: [],
          error: "AdMob API 자격 증명이 설정되지 않았습니다.",
        });
      }

      const { admob, accountName } = client;

      const [appsRes, unitsRes] = await Promise.all([
        admob.accounts.apps.list({ parent: accountName, pageSize: 50 }),
        admob.accounts.adUnits.list({ parent: accountName, pageSize: 200 }),
      ]);

      const platformByAppId = new Map<string, string>();
      const apps = (appsRes.data.apps ?? []).map((app) => {
        const appId = app.appId ?? "";
        const platform = app.platform ?? "UNKNOWN";
        if (appId) {
          platformByAppId.set(appId, platform);
        }
        return {
          displayName: app.name ?? app.linkedAppInfo?.displayName ?? app.manualAppInfo?.displayName ?? "",
          appId,
          platform,
        };
      });

      const adUnits = (unitsRes.data.adUnits ?? []).map((unit) => ({
        displayName: unit.displayName ?? "",
        adUnitId: unit.adUnitId ?? "",
        adFormat: unit.adFormat ?? "",
        appId: unit.appId ?? "",
        platform: unit.appId ? platformByAppId.get(unit.appId) ?? "UNKNOWN" : "UNKNOWN",
      }));

      res.json({
        configured: true,
        apps,
        adUnits,
      });
    } catch (error: any) {
      console.error("AdMob ad units list failed:", error);
      res.status(200).json({
        configured: false,
        apps: [],
        adUnits: [],
        error: error.message || "광고 단위 조회 실패",
      });
    }
  });

  app.get("/api/admin/admob/revenue-report", adminAuthMiddleware, async (req, res) => {
    try {
      const platform: RevenuePlatform =
        (req.query.platform as string) === "badminton9" ? "badminton9" : "ppamong";

      const client = await createAdmobApiClient();
      if (!client) {
        return res.status(200).json({
          error: "AdMob API 자격 증명이 설정되지 않았습니다.",
          configured: false,
          platform,
          totalViews: 0,
          totalImpressions: 0,
          totalRevenue: 0,
          dailyRevenueData: [],
          currencyCode: "KRW",
          counts: { ppamong: 0, badminton9: 0 },
          appBreakdown: [],
        });
      }

      const config = await appAdmobConfigStorage.getConfig();
      const result = await fetchAdmobRevenueReport(
        client.admob,
        client.accountName,
        config,
        platform,
      );
      res.json(result);
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      console.error("AdMob 리포트 조회 실패:", error);
      const platform: RevenuePlatform =
        (req.query.platform as string) === "badminton9" ? "badminton9" : "ppamong";

      if (err.code === 403 || err.code === 401) {
        return res.status(200).json({
          error: "AdMob API 접근 권한이 없습니다. 자격 증명을 확인해주세요.",
          configured: false,
          platform,
          totalViews: 0,
          totalImpressions: 0,
          totalRevenue: 0,
          dailyRevenueData: [],
          currencyCode: "KRW",
          counts: { ppamong: 0, badminton9: 0 },
          appBreakdown: [],
        });
      }

      res.status(200).json({
        error: `AdMob 리포트 조회에 실패했습니다: ${err.message ?? "unknown"}`,
        configured: false,
        platform,
        totalViews: 0,
        totalImpressions: 0,
        totalRevenue: 0,
        dailyRevenueData: [],
        currencyCode: "KRW",
        counts: { ppamong: 0, badminton9: 0 },
        appBreakdown: [],
      });
    }
  });
}
