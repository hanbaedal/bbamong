/**
 * AdMob OAuth 리프레시 토큰 발급 도우미
 *
 * 사전 준비 (Google Cloud Console):
 * 1. AdMob API 활성화
 * 2. OAuth 클라이언트 유형: 「데스크톱 앱」 또는 「웹 애플리케이션」
 * 3. 웹 앱인 경우 승인된 리디렉션 URI에 http://localhost 추가
 * 4. Replit Secrets에 ADMOB_CLIENT_ID, ADMOB_CLIENT_SECRET 설정
 *
 * 실행: npm run admob:auth
 */
import "dotenv/config";
import readline from "readline";
import { google } from "googleapis";

const clientId = process.env.ADMOB_CLIENT_ID?.trim();
const clientSecret = process.env.ADMOB_CLIENT_SECRET?.trim();
const redirectUri = "http://localhost";

if (!clientId || !clientSecret) {
  console.error("ADMOB_CLIENT_ID, ADMOB_CLIENT_SECRET을 Secrets에 먼저 설정하세요.");
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
      console.error("리프레시 토큰이 없습니다. Google 계정 연결을 해제한 뒤 prompt=consent로 다시 시도하세요.");
      process.exit(1);
    }

    console.log("\n=== 성공 ===\n");
    console.log("Replit Secrets에 아래를 저장하세요:\n");
    console.log(`ADMOB_REFRESH_TOKEN=${tokens.refresh_token}`);
    if (process.env.ADMOB_PUBLISHER_ID) {
      console.log(`ADMOB_PUBLISHER_ID=${process.env.ADMOB_PUBLISHER_ID} (기존 유지)`);
    } else {
      console.log("ADMOB_PUBLISHER_ID=pub-xxxxxxxx (AdMob → 설정에서 확인)");
    }
    console.log("\n저장 후: npm run check:admob");
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || String(error);
    console.error("토큰 교환 실패:", message);
    if (message === "invalid_client") {
      console.error("CLIENT_ID/SECRET 확인 및 OAuth 클라이언트 리디렉션 URI에 http://localhost 등록");
    }
    process.exit(1);
  }
});
