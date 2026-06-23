import type { Express } from "express";
import { google } from "googleapis";
import { adminAuthMiddleware } from "../middleware/adminAuth";

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

export async function adminAdmobRoutes(app: Express): Promise<void> {
  app.get("/api/admin/admob/revenue-report", adminAuthMiddleware, async (req, res) => {
    try {
      const refreshToken = process.env.ADMOB_REFRESH_TOKEN?.trim();
      const clientId = process.env.ADMOB_CLIENT_ID?.trim();
      const clientSecret = process.env.ADMOB_CLIENT_SECRET?.trim();
      const publisherId = process.env.ADMOB_PUBLISHER_ID?.trim();

      if (!refreshToken || !clientId || !clientSecret || !publisherId) {
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

      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const admob = google.admob({ version: "v1", auth: oauth2Client });
      const accountName = publisherId.trim().startsWith("accounts/")
        ? publisherId.trim()
        : publisherId.trim().startsWith("pub-")
          ? `accounts/${publisherId.trim()}`
          : `accounts/pub-${publisherId.trim()}`;

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
