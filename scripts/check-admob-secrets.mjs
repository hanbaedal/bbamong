import "dotenv/config";
import { google } from "googleapis";

function env(name) {
  return process.env[name]?.trim() ?? "";
}

function mask(value) {
  if (!value) return "(없음)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

const clientId = env("ADMOB_CLIENT_ID");
const clientSecret = env("ADMOB_CLIENT_SECRET");
const refreshToken = env("ADMOB_REFRESH_TOKEN");
const publisherId = env("ADMOB_PUBLISHER_ID");

const missing = [];
if (!clientId) missing.push("ADMOB_CLIENT_ID");
if (!clientSecret) missing.push("ADMOB_CLIENT_SECRET");
if (!refreshToken) missing.push("ADMOB_REFRESH_TOKEN");
if (!publisherId) missing.push("ADMOB_PUBLISHER_ID");

if (missing.length > 0) {
  console.error("누락된 환경 변수:", missing.join(", "));
  console.error("Replit Secrets에 4개 값이 모두 있는지 확인하세요.");
  process.exit(1);
}

console.log("환경 변수 로드됨:");
console.log(`  ADMOB_CLIENT_ID: ${mask(clientId)} (${clientId.endsWith(".apps.googleusercontent.com") ? "형식 OK" : "형식 확인 필요"})`);
console.log(`  ADMOB_CLIENT_SECRET: ${mask(clientSecret)} (${clientSecret.startsWith("GOCSPX-") ? "형식 OK" : "형식 확인 필요"})`);
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
    console.error("  • Replit Secrets 값에 따옴표·공백이 들어가지 않았는지 확인");
    console.error("  • Google Cloud → 사용자 인증 정보 → 해당 OAuth 클라이언트의 시크릿 재확인");
    console.error("  • 시크릿을 재발급했다면 새 시크릿으로 Secrets 업데이트");
    console.error("  • 회원 로그인용 GOOGLE_CLIENT_ID와 ADMOB용은 별개입니다");
  } else if (message === "invalid_grant") {
    console.error("【invalid_grant】 리프레시 토큰이 만료되었거나 다른 클라이언트로 발급됨");
    console.error("  • npm run admob:auth 로 새 리프레시 토큰 발급");
  } else {
    console.error("  • npm run admob:auth 로 OAuth 재설정 시도");
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
  const message = error?.message || String(error);
  console.error("AdMob API 실패:", message);
  if (error?.code === 403) {
    console.error("  • Google Cloud에서 AdMob API가 활성화되어 있는지 확인");
    console.error("  • OAuth 동의 화면에 admob.readonly 스코프 포함 여부 확인");
  }
  process.exit(1);
}
