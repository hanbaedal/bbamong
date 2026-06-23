import "dotenv/config";
import { google } from "googleapis";
import { getAdmobEnv, getAdmobEnvMisconfigurationHint } from "./lib/admob-env.mjs";

function mask(value) {
  if (!value) return "(없음)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

const misconfig = getAdmobEnvMisconfigurationHint();
if (misconfig) {
  console.error(misconfig);
  process.exit(1);
}

const { clientId, clientSecret, refreshToken, publisherId } = getAdmobEnv();

const missing = [];
if (!clientId) missing.push("ADMOB_CLIENT_ID");
if (!clientSecret) missing.push("ADMOB_CLIENT_SECRET");
if (!refreshToken) missing.push("ADMOB_REFRESH_TOKEN");
if (!publisherId) missing.push("ADMOB_PUBLISHER_ID");

if (missing.length > 0) {
  console.error("누락된 환경 변수:", missing.join(", "));
  process.exit(1);
}

if (clientId.includes(" ") || clientSecret.includes(" ")) {
  console.error("CLIENT_ID/SECRET에 공백이 있습니다. Replit Secrets를 키별로 나눠 등록하세요.");
  process.exit(1);
}

console.log("환경 변수 로드됨:");
console.log(
  `  ADMOB_CLIENT_ID: ${mask(clientId)} (${clientId.endsWith(".apps.googleusercontent.com") ? "형식 OK" : "형식 확인 필요"})`,
);
console.log(
  `  ADMOB_CLIENT_SECRET: ${mask(clientSecret)} (${clientSecret.startsWith("GOCSPX-") ? "형식 OK" : "형식 확인 필요"})`,
);
console.log(`  ADMOB_REFRESH_TOKEN: ${mask(refreshToken)}`);
console.log(`  ADMOB_PUBLISHER_ID: ${publisherId}`);
console.log("");

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
oauth2Client.setCredentials({ refresh_token: refreshToken });

try {
  console.log("1/2 OAuth 액세스 토큰 발급 시도...");
  await oauth2Client.getAccessToken();
  console.log("   → OAuth 클라이언트 ID/시크릿/리프레시 토큰 OK");
} catch (error) {
  const message = error?.response?.data?.error || error?.message || String(error);
  const description = error?.response?.data?.error_description || "";

  console.error("   → OAuth 실패:", message);
  if (description) console.error("   →", description);
  console.error("");

  if (message === "invalid_client") {
    console.error("【invalid_client】 CLIENT_ID 또는 CLIENT_SECRET이 잘못되었습니다.");
    console.error("  • Replit: 키 이름 ADMOB_CLIENT_ID, 값은 ID만 (ADMOB_CLIENT_ID= 붙이지 않음)");
    console.error("  • Google Cloud OAuth 클라이언트 시크릿 재확인");
  } else if (message === "invalid_grant") {
    console.error("【invalid_grant】 npm run admob:auth 로 새 리프레시 토큰 발급");
  }

  process.exit(1);
}

const accountName = publisherId.startsWith("accounts/")
  ? publisherId
  : publisherId.startsWith("pub-")
    ? `accounts/${publisherId}`
    : `accounts/pub-${publisherId}`;

const admob = google.admob({ version: "v1", auth: oauth2Client });

try {
  console.log("2/2 AdMob 수익 리포트 API 호출...");
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
  console.error("AdMob API 실패:", error?.message || error);
  process.exit(1);
}
