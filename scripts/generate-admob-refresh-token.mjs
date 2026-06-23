/**
 * AdMob OAuth 리프레시 토큰 발급 도우미
 *
 * Replit Secrets (키 4개, 값에는 = 뒤만):
 *   ADMOB_CLIENT_ID, ADMOB_CLIENT_SECRET, ADMOB_PUBLISHER_ID (선택)
 *
 * Google Cloud: OAuth 클라이언트 + 리디렉션 URI http://localhost
 * 실행: npm run admob:auth
 */
import "dotenv/config";
import readline from "readline";
import { google } from "googleapis";
import { getAdmobEnv, getAdmobEnvMisconfigurationHint } from "./lib/admob-env.mjs";

const misconfig = getAdmobEnvMisconfigurationHint();
if (misconfig) {
  console.error(misconfig);
  process.exit(1);
}

const { clientId, clientSecret } = getAdmobEnv();
const redirectUri = "http://localhost";

if (!clientId || !clientSecret) {
  console.error("ADMOB_CLIENT_ID, ADMOB_CLIENT_SECRET을 Secrets에 각각 따로 설정하세요.");
  process.exit(1);
}

if (clientId.includes(" ") || clientId.includes("ADMOB_")) {
  console.error("ADMOB_CLIENT_ID 값이 잘못되었습니다. = 앞 키 이름 없이 ID만 넣으세요.");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const scopes = ["https://www.googleapis.com/auth/admob.readonly"];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: scopes,
});

console.log("=== AdMob 리프레시 토큰 발급 ===\n");
console.log(`CLIENT_ID: ${clientId.slice(0, 12)}...${clientId.slice(-20)}\n`);
console.log("1. 아래 URL을 브라우저에서 열고 AdMob 계정으로 로그인·승인하세요.\n");
console.log(authUrl);
console.log("\n2. 승인 후 주소창이 http://localhost/?code=... 로 바뀝니다.");
console.log("   code= 뒤의 값(또는 전체 리디렉션 URL)을 붙여넣으세요.\n");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("인증 코드 또는 리디렉션 URL: ", async (input) => {
  rl.close();

  let code = input.trim();
  try {
    if (code.includes("code=")) {
      const url = new URL(code.startsWith("http") ? code : `http://localhost/?${code}`);
      code = url.searchParams.get("code") ?? code;
    }
  } catch {
    // raw code paste
  }

  if (!code) {
    console.error("인증 코드가 비어 있습니다.");
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      console.error("리프레시 토큰이 없습니다. Google 계정 연결 해제 후 다시 시도하세요.");
      process.exit(1);
    }

    console.log("\n=== 성공 ===\n");
    console.log("Replit Secrets → ADMOB_REFRESH_TOKEN 키에 아래 값만 저장:\n");
    console.log(tokens.refresh_token);
    console.log("\n저장 후 Stop → Run, npm run check:admob");
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || String(error);
    console.error("토큰 교환 실패:", message);
    process.exit(1);
  }
});
