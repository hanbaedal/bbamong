import "dotenv/config";
import { google } from "googleapis";

const required = [
  "ADMOB_CLIENT_ID",
  "ADMOB_CLIENT_SECRET",
  "ADMOB_PUBLISHER_ID",
  "ADMOB_REFRESH_TOKEN",
];

const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error("누락된 환경 변수:", missing.join(", "));
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  process.env.ADMOB_CLIENT_ID,
  process.env.ADMOB_CLIENT_SECRET,
);
oauth2Client.setCredentials({
  refresh_token: process.env.ADMOB_REFRESH_TOKEN,
});

const admob = google.admob({ version: "v1", auth: oauth2Client });
const publisherId = process.env.ADMOB_PUBLISHER_ID.trim();
const accountName = publisherId.startsWith("accounts/")
  ? publisherId
  : publisherId.startsWith("pub-")
    ? `accounts/${publisherId}`
    : `accounts/pub-${publisherId}`;

try {
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 7);

  await admob.accounts.networkReport.generate({
    parent: accountName,
    requestBody: {
      reportSpec: {
        dateRange: {
          startDate: {
            year: start.getFullYear(),
            month: start.getMonth() + 1,
            day: start.getDate(),
          },
          endDate: {
            year: today.getFullYear(),
            month: today.getMonth() + 1,
            day: today.getDate(),
          },
        },
        dimensions: ["DATE"],
        metrics: ["ESTIMATED_EARNINGS"],
        localizationSettings: { currencyCode: "KRW", languageCode: "ko-KR" },
      },
    },
  });

  console.log("AdMob 연결 OK:", accountName);
} catch (error) {
  console.error("AdMob 연결 실패:", error.message || error);
  process.exit(1);
}
