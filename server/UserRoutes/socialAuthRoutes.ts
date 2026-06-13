import type { Express, Request, Response } from "express";
import { userStorage } from "../UserStorage/userStorage";
import { 
  generateUserAccessToken, 
  generateUserRefreshToken 
} from "../utils/jwt";
import { createSession, hasActiveSession, deleteSession } from "../sessionManager";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../UserStorage/db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getRedisClient } from "../redis";

const AUTH_CODE_PREFIX = "authcode:";
const AUTH_CODE_TTL = 300; // 5분 (초)

async function setAuthCode(code: string, data: { accessToken: string; refreshToken: string }): Promise<void> {
  const redis = getRedisClient();
  await redis.set(`${AUTH_CODE_PREFIX}${code}`, JSON.stringify(data), "EX", AUTH_CODE_TTL);
}

async function getAndDeleteAuthCode(code: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const redis = getRedisClient();
  const key = `${AUTH_CODE_PREFIX}${code}`;
  const data = await redis.get(key);
  if (!data) return null;
  await redis.del(key);
  return JSON.parse(data);
}

interface SocialPendingData {
  provider: 'kakao' | 'google' | 'apple';
  providerId: string;
  email: string;
  name: string;
  phone: string | null;
}

const SOCIAL_PENDING_PREFIX = "social_pending:";
const SOCIAL_PENDING_TTL = 600; // 10분

async function setSocialPendingData(code: string, data: SocialPendingData): Promise<void> {
  const redis = getRedisClient();
  await redis.set(`${SOCIAL_PENDING_PREFIX}${code}`, JSON.stringify(data), "EX", SOCIAL_PENDING_TTL);
}

export async function getSocialPendingData(code: string): Promise<SocialPendingData | null> {
  const redis = getRedisClient();
  const key = `${SOCIAL_PENDING_PREFIX}${code}`;
  const data = await redis.get(key);
  if (!data) return null;
  return JSON.parse(data);
}

export async function deleteSocialPendingData(code: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`${SOCIAL_PENDING_PREFIX}${code}`);
}

// OAuth 설정 타입
interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

// 각 플랫폼별 OAuth 설정
function getOAuthConfig(provider: 'kakao' | 'google' | 'apple'): OAuthConfig {
  // 개발: http://localhost:5000, 프로덕션: https://ppadun9.com
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = isProduction 
    ? 'https://ppadun9.com' 
    : 'http://localhost:5000';
  
  switch (provider) {
    case 'kakao':
      return {
        clientId: process.env.KAKAO_CLIENT_ID || '',
        clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
        redirectUri: `${baseUrl}/api/auth/kakao/callback`,
        authorizationUrl: 'https://kauth.kakao.com/oauth/authorize',
        tokenUrl: 'https://kauth.kakao.com/oauth/token',
        userInfoUrl: 'https://kapi.kakao.com/v2/user/me',
      };
    case 'google':
      return {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: `${baseUrl}/api/auth/google/callback`,
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      };
    case 'apple':
      return {
        clientId: process.env.APPLE_CLIENT_ID || '',
        clientSecret: '', // 애플은 client_secret을 JWT로 동적 생성 (generateAppleClientSecret 사용)
        redirectUri: `${baseUrl}/api/auth/callback/apple`,
        authorizationUrl: 'https://appleid.apple.com/auth/authorize',
        tokenUrl: 'https://appleid.apple.com/auth/token',
        userInfoUrl: '', // Apple은 ID token에서 정보 추출
      };
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// 닉네임 최대 길이 제한 (15자)
function truncateName(name: string, maxLength: number = 15): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength);
}

// 카카오 사용자 정보 파싱
function parseKakaoUserInfo(userInfo: any) {
  const phone = userInfo.kakao_account?.phone_number;
  return {
    providerId: userInfo.id.toString(),
    email: userInfo.kakao_account?.email || '',
    name: truncateName(userInfo.kakao_account?.profile?.nickname || ''),
    phone: phone && phone.trim() !== '' ? phone : null,
  };
}

// 구글 사용자 정보 파싱
function parseGoogleUserInfo(userInfo: any) {
  return {
    providerId: userInfo.id || userInfo.sub,
    email: userInfo.email || '',
    name: truncateName(userInfo.name || ''),
    phone: null,
  };
}

// 애플 사용자 정보 파싱 (ID token에서)
function parseAppleUserInfo(idToken: string, userName?: { firstName?: string; lastName?: string }) {
  // JWT 디코딩 (간단한 방법, 실제로는 검증 필요)
  const payload = JSON.parse(
    Buffer.from(idToken.split('.')[1], 'base64').toString()
  );
  
  // 애플은 첫 로그인 시에만 이름을 전달함
  let name = '';
  if (userName?.firstName || userName?.lastName) {
    name = `${userName.firstName || ''} ${userName.lastName || ''}`.trim();
  }
  if (!name) {
    // fallback 이름도 15자 제한 적용
    const emailPrefix = payload.email?.split('@')[0] || '';
    name = emailPrefix ? truncateName(emailPrefix) : '애플사용자';
  }
  
  return {
    providerId: payload.sub,
    email: payload.email || '',
    name: truncateName(name),
    phone: null,
  };
}

function sendAuthResponse(res: Response, deeplink: string, provider: string, isCapacitor: boolean, isIOS: boolean = false): void {
  const deeplinkUrl = new URL(deeplink.replace('ppadun9://', 'https://dummy/'));
  const webFallbackUrl = '/login?' + deeplinkUrl.searchParams.toString();
  
  if (!isCapacitor) {
    res.redirect(webFallbackUrl);
    return;
  }
  
  // iOS: SFSafariViewController에서는 HTTP 302 리다이렉트로 커스텀 스킴 호출이 가장 안정적
  if (isIOS) {
    res.redirect(deeplink);
    return;
  }
  
  // Android: HTML 페이지로 딥링크 시도 → intent:// 폴백 → 웹 폴백
  // 삼성 인터넷 등 커스텀 스킴 302 리다이렉트를 처리 못하는 브라우저 대응
  res.send(generateDeeplinkRedirectHtml(deeplink, provider));
}

// 딥링크 리다이렉트 HTML 페이지 생성 (iOS: 커스텀 스킴, Android: intent://)
function generateDeeplinkRedirectHtml(deeplink: string, provider: string): string {
  const deeplinkUrl = new URL(deeplink.replace('ppadun9://', 'https://dummy/'));
  const webFallbackUrl = '/login?' + deeplinkUrl.searchParams.toString();
  
  const intentPath = deeplink.replace('ppadun9://', '');
  const intentUrl = `intent://${intentPath}#Intent;scheme=ppadun9;package=com.bbanden.nine;S.browser_fallback_url=${encodeURIComponent(webFallbackUrl)};end`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>로그인 처리 중...</title>
  <style>
    body {
      background: #111111;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #333;
      border-top-color: #E11937;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .message {
      text-align: center;
      font-size: 16px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <div class="message">로그인 처리 중입니다...</div>
  <script>
    (function() {
      var deeplink = "${deeplink}";
      var intentUrl = "${intentUrl}";
      var webFallback = "${webFallbackUrl}";
      var appOpened = false;
      var webTimer = null;
      var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      function cleanup() {
        appOpened = true;
        if (webTimer) { clearTimeout(webTimer); webTimer = null; }
      }
      
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
          cleanup();
          try { window.close(); } catch(e) {}
        }
      });
      
      window.addEventListener('pagehide', function() {
        cleanup();
      });
      
      if (isIOS) {
        window.location.href = deeplink;
      } else {
        window.location.href = intentUrl;
      }
      
      webTimer = setTimeout(function() {
        if (appOpened) return;
        cleanup();
        window.location.href = webFallback;
      }, 3000);
    })();
  </script>
</body>
</html>
  `.trim();
}

// 애플 Client Secret JWT 생성
function generateAppleClientSecret(): string {
  const teamId = process.env.APPLE_TEAM_ID || '';
  const clientId = process.env.APPLE_CLIENT_ID || '';
  const keyId = process.env.APPLE_KEY_ID || '';
  const privateKey = process.env.APPLE_PRIVATE_KEY || '';

  if (!teamId || !clientId || !keyId || !privateKey) {
    throw new Error('애플 로그인 설정이 올바르지 않습니다.');
  }

  // 개행문자 처리 (.p8 파일 내용이 환경변수로 저장될 때 \n이 문자열로 저장됨)
  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  
  const claims = {
    iss: teamId,
    aud: 'https://appleid.apple.com',
    sub: clientId,
    iat: now,
    exp: now + (86400 * 180), // 180일 (최대 6개월)
  };

  return jwt.sign(claims, formattedPrivateKey, {
    algorithm: 'ES256',
    header: {
      kid: keyId,
      alg: 'ES256',
    },
  });
}

export function registerSocialAuthRoutes(app: Express) {
  // 카카오 로그인 시작
  app.get("/api/auth/kakao", (req: Request, res: Response) => {
    const config = getOAuthConfig('kakao');
    const source = req.query.source as string || '';
    const platform = req.query.platform as string || '';
    
    let stateValue = '';
    if (source === 'capacitor') {
      stateValue = platform === 'ios' ? 'capacitor_ios' : 'capacitor';
    }
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state: stateValue,
    });
    
    res.redirect(`${config.authorizationUrl}?${params.toString()}`);
  });

  // 카카오 콜백 (새 경로) - Capacitor는 바로 리다이렉트, 그 외는 딥링크
  app.get("/api/auth/kakao/callback", async (req: Request, res: Response) => {
    const stateValue = req.query.state as string || '';
    const isCapacitor = stateValue === 'capacitor' || stateValue === 'capacitor_ios';
    const isIOS = stateValue === 'capacitor_ios';
    try {
      const { code } = req.query;
      
      console.log('[카카오] 콜백 수신, code:', code ? '있음' : '없음', 'isCapacitor:', isCapacitor);
      
      if (!code || typeof code !== 'string') {
        console.error('[카카오] 인증 코드 없음');
        return sendAuthResponse(res, 'ppadun9://auth?error=no_code', 'kakao', isCapacitor, isIOS);
      }

      const config = getOAuthConfig('kakao');
      console.log('[카카오] 콜백 수신, isIOS:', isIOS, 'redirect_uri:', config.redirectUri);

      // 1. 토큰 교환
      const tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          code,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error('[카카오] 토큰 교환 실패:', errorData);
        return sendAuthResponse(res, 'ppadun9://auth?error=token_exchange_failed', 'kakao', isCapacitor, isIOS);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      console.log('[카카오] 토큰 교환 성공');

      // 2. 사용자 정보 가져오기
      const userInfoResponse = await fetch(config.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        console.error('[카카오] 사용자 정보 조회 실패:', errorText);
        return sendAuthResponse(res, 'ppadun9://auth?error=user_info_failed', 'kakao', isCapacitor, isIOS);
      }

      const userInfo = await userInfoResponse.json();
      console.log('[카카오] 사용자 정보:', JSON.stringify(userInfo));
      const parsedInfo = parseKakaoUserInfo(userInfo);
      console.log('[카카오] 파싱된 정보:', parsedInfo);

      // 3. DB에서 기존 사용자 찾기
      let user = await userStorage.getUserByProvider('kakao', parsedInfo.providerId);
      console.log('[카카오] 기존 사용자:', user ? '있음' : '없음');
      
      if (!user) {
        // 신규 사용자: 계정 생성하지 않고 임시 데이터 저장 → 추가정보 입력 후 생성
        const pendingCode = crypto.randomBytes(32).toString('hex');
        await setSocialPendingData(pendingCode, {
          provider: 'kakao',
          providerId: parsedInfo.providerId,
          email: parsedInfo.email || '',
          name: parsedInfo.name || '',
          phone: parsedInfo.phone || null,
        });
        console.log('[카카오] 신규 사용자 - 임시 데이터 저장, 추가정보 입력 필요');
        return sendAuthResponse(res, `ppadun9://auth?kakao_login=success&code=${pendingCode}&needs_onboarding=true`, 'kakao', isCapacitor, isIOS);
      }

      // 기존 사용자 재로그인
      if (user.isSuspended === 1) {
        return sendAuthResponse(res, 'ppadun9://auth?error=suspended', 'kakao', isCapacitor, isIOS);
      }

      const hasSession = await hasActiveSession("user", user.id);
      if (hasSession) {
        console.log(`[카카오] 기존 세션 강제 교체: ${user.id}`);
        await deleteSession("user", user.id);
      }

      const tokenPayload = {
        userId: user.id,
        username: user.username,
      };

      const jwtAccessToken = generateUserAccessToken(tokenPayload);
      const jwtRefreshToken = generateUserRefreshToken(tokenPayload);

      await createSession("user", user.id, {
        username: user.username,
      });

      const now = new Date();
      await db.update(users).set({ lastLogin: now, lastActive: now }).where(eq(users.id, user.id));

      const authCode = crypto.randomBytes(32).toString('hex');
      await setAuthCode(authCode, {
        accessToken: jwtAccessToken,
        refreshToken: jwtRefreshToken,
      });
      
      sendAuthResponse(res, `ppadun9://auth?kakao_login=success&code=${authCode}`, 'kakao', isCapacitor, isIOS);
    } catch (error) {
      console.error('카카오 로그인 에러:', error);
      sendAuthResponse(res, 'ppadun9://auth?error=login_failed', 'kakao', isCapacitor, isIOS);
    }
  });

  // 카카오 토큰 교환 엔드포인트 (일회용 코드로 토큰 교환)
  app.post("/api/auth/kakao/exchange-token", async (req: Request, res: Response) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: "인증 코드가 없습니다." });
    }

    const tokenData = await getAndDeleteAuthCode(code);
    
    if (!tokenData) {
      return res.status(400).json({ error: "유효하지 않거나 만료된 코드입니다." });
    }

    res.json({ 
      accessToken: tokenData.accessToken, 
      refreshToken: tokenData.refreshToken 
    });
  });

  // 기존 경로도 유지 (하위 호환성)
  app.get("/api/auth/callback/kakao", async (req: Request, res: Response) => {
    res.redirect(`/api/auth/kakao/callback?${new URLSearchParams(req.query as Record<string, string>).toString()}`);
  });

  // 구글 로그인 시작
  app.get("/api/auth/google", (req: Request, res: Response) => {
    const config = getOAuthConfig('google');
    const source = req.query.source as string || '';
    const platform = req.query.platform as string || '';
    
    let stateValue = '';
    if (source === 'capacitor') {
      stateValue = platform === 'ios' ? 'capacitor_ios' : 'capacitor';
    }
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
      state: stateValue,
    });
    
    res.redirect(`${config.authorizationUrl}?${params.toString()}`);
  });

  // 구글 콜백 - Capacitor는 바로 리다이렉트, 그 외는 딥링크
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const stateValue = req.query.state as string || '';
    const isCapacitor = stateValue === 'capacitor' || stateValue === 'capacitor_ios';
    const isIOS = stateValue === 'capacitor_ios';
    try {
      const { code } = req.query;
      
      console.log('[구글] 콜백 수신, code:', code ? '있음' : '없음', 'isCapacitor:', isCapacitor, 'isIOS:', isIOS);
      
      if (!code || typeof code !== 'string') {
        console.error('[구글] 인증 코드 없음');
        return sendAuthResponse(res, 'ppadun9://auth?error=no_code', 'google', isCapacitor, isIOS);
      }

      const config = getOAuthConfig('google');

      // 1. 토큰 교환
      const tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          code,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error('[구글] 토큰 교환 실패:', errorData);
        return sendAuthResponse(res, 'ppadun9://auth?error=token_exchange_failed', 'google', isCapacitor, isIOS);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      console.log('[구글] 토큰 교환 성공');

      // 2. 사용자 정보 가져오기
      const userInfoResponse = await fetch(config.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        console.error('[구글] 사용자 정보 조회 실패:', errorText);
        return sendAuthResponse(res, 'ppadun9://auth?error=user_info_failed', 'google', isCapacitor, isIOS);
      }

      const userInfo = await userInfoResponse.json();
      const parsedInfo = parseGoogleUserInfo(userInfo);

      // 3. DB에서 기존 사용자 찾기
      let user = await userStorage.getUserByProvider('google', parsedInfo.providerId);
      
      if (!user) {
        // 신규 사용자: 계정 생성하지 않고 임시 데이터 저장 → 추가정보 입력 후 생성
        const pendingCode = crypto.randomBytes(32).toString('hex');
        await setSocialPendingData(pendingCode, {
          provider: 'google',
          providerId: parsedInfo.providerId,
          email: parsedInfo.email || '',
          name: parsedInfo.name || '',
          phone: parsedInfo.phone || null,
        });
        console.log('[구글] 신규 사용자 - 임시 데이터 저장, 추가정보 입력 필요');
        return sendAuthResponse(res, `ppadun9://auth?google_login=success&code=${pendingCode}&needs_onboarding=true`, 'google', isCapacitor, isIOS);
      }

      // 기존 사용자 재로그인
      if (user.isSuspended === 1) {
        return sendAuthResponse(res, 'ppadun9://auth?error=suspended', 'google', isCapacitor, isIOS);
      }

      const hasSession = await hasActiveSession("user", user.id);
      if (hasSession) {
        console.log(`[구글] 기존 세션 강제 교체: ${user.id}`);
        await deleteSession("user", user.id);
      }

      const tokenPayload = {
        userId: user.id,
        username: user.username,
      };

      const jwtAccessToken = generateUserAccessToken(tokenPayload);
      const jwtRefreshToken = generateUserRefreshToken(tokenPayload);

      await createSession("user", user.id, {
        username: user.username,
      });

      const now = new Date();
      await db.update(users).set({ lastLogin: now, lastActive: now }).where(eq(users.id, user.id));

      const authCode = crypto.randomBytes(32).toString('hex');
      await setAuthCode(authCode, {
        accessToken: jwtAccessToken,
        refreshToken: jwtRefreshToken,
      });
      
      sendAuthResponse(res, `ppadun9://auth?google_login=success&code=${authCode}`, 'google', isCapacitor, isIOS);
    } catch (error) {
      console.error('구글 로그인 에러:', error);
      sendAuthResponse(res, 'ppadun9://auth?error=login_failed', 'google', isCapacitor, isIOS);
    }
  });

  // 구글 토큰 교환 엔드포인트 (일회용 코드로 토큰 교환)
  app.post("/api/auth/google/exchange-token", async (req: Request, res: Response) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: "인증 코드가 없습니다." });
    }

    const tokenData = await getAndDeleteAuthCode(code);
    
    if (!tokenData) {
      return res.status(400).json({ error: "유효하지 않거나 만료된 코드입니다." });
    }

    res.json({ 
      accessToken: tokenData.accessToken, 
      refreshToken: tokenData.refreshToken 
    });
  });

  // 기존 경로도 유지 (하위 호환성)
  app.get("/api/auth/callback/google", async (req: Request, res: Response) => {
    res.redirect(`/api/auth/google/callback?${new URLSearchParams(req.query as Record<string, string>).toString()}`);
  });

  // 애플 로그인 시작
  app.get("/api/auth/apple", (req: Request, res: Response) => {
    const config = getOAuthConfig('apple');
    const source = req.query.source as string || '';
    const platform = req.query.platform as string || '';
    
    let stateValue = '';
    if (source === 'capacitor') {
      stateValue = platform === 'ios' ? 'capacitor_ios' : 'capacitor';
    }
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code id_token',
      response_mode: 'form_post',
      scope: 'name email',
      state: stateValue,
    });
    
    res.redirect(`${config.authorizationUrl}?${params.toString()}`);
  });

  // 애플 콜백 (POST) - Capacitor는 바로 리다이렉트, 그 외는 딥링크
  app.post("/api/auth/callback/apple", async (req: Request, res: Response) => {
    const stateValue = req.body.state as string || '';
    const isCapacitor = stateValue === 'capacitor' || stateValue === 'capacitor_ios';
    const isIOS = stateValue === 'capacitor_ios';
    try {
      const { code, id_token, user: userJson } = req.body;
      
      console.log('[애플] 콜백 수신, code:', code ? '있음' : '없음', 'id_token:', id_token ? '있음' : '없음', 'isCapacitor:', isCapacitor, 'isIOS:', isIOS);
      
      if (!id_token) {
        console.error('[애플] ID 토큰 없음');
        return sendAuthResponse(res, 'ppadun9://auth?error=no_token', 'apple', isCapacitor, isIOS);
      }

      // 애플은 첫 로그인 시에만 user 정보를 전달
      let userName: { firstName?: string; lastName?: string } | undefined;
      if (userJson) {
        try {
          const userData = typeof userJson === 'string' ? JSON.parse(userJson) : userJson;
          userName = userData.name;
        } catch (e) {
          console.log('[애플] user JSON 파싱 실패:', e);
        }
      }

      const parsedInfo = parseAppleUserInfo(id_token, userName);

      // DB에서 기존 사용자 찾기
      let user = await userStorage.getUserByProvider('apple', parsedInfo.providerId);
      
      if (!user) {
        // 신규 사용자: 계정 생성하지 않고 임시 데이터 저장 → 추가정보 입력 후 생성
        const pendingCode = crypto.randomBytes(32).toString('hex');
        await setSocialPendingData(pendingCode, {
          provider: 'apple',
          providerId: parsedInfo.providerId,
          email: parsedInfo.email || '',
          name: parsedInfo.name || '',
          phone: parsedInfo.phone || null,
        });
        console.log('[애플] 신규 사용자 - 임시 데이터 저장, 추가정보 입력 필요');
        return sendAuthResponse(res, `ppadun9://auth?apple_login=success&code=${pendingCode}&needs_onboarding=true`, 'apple', isCapacitor, isIOS);
      }

      // 기존 사용자 재로그인
      if (user.isSuspended === 1) {
        return sendAuthResponse(res, 'ppadun9://auth?error=suspended', 'apple', isCapacitor, isIOS);
      }

      const hasSession = await hasActiveSession("user", user.id);
      if (hasSession) {
        console.log(`[애플] 기존 세션 강제 교체: ${user.id}`);
        await deleteSession("user", user.id);
      }

      const tokenPayload = {
        userId: user.id,
        username: user.username,
      };

      const jwtAccessToken = generateUserAccessToken(tokenPayload);
      const jwtRefreshToken = generateUserRefreshToken(tokenPayload);

      await createSession("user", user.id, {
        username: user.username,
      });

      const now = new Date();
      await db.update(users).set({ lastLogin: now, lastActive: now }).where(eq(users.id, user.id));

      const authCode = crypto.randomBytes(32).toString('hex');
      await setAuthCode(authCode, {
        accessToken: jwtAccessToken,
        refreshToken: jwtRefreshToken,
      });
      
      sendAuthResponse(res, `ppadun9://auth?apple_login=success&code=${authCode}`, 'apple', isCapacitor, isIOS);
    } catch (error) {
      console.error('애플 로그인 에러:', error);
      sendAuthResponse(res, 'ppadun9://auth?error=login_failed', 'apple', isCapacitor, isIOS);
    }
  });

  // 애플 토큰 교환 엔드포인트 (일회용 코드로 토큰 교환)
  app.post("/api/auth/apple/exchange-token", async (req: Request, res: Response) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: "인증 코드가 없습니다." });
    }

    const tokenData = await getAndDeleteAuthCode(code);
    
    if (!tokenData) {
      return res.status(400).json({ error: "유효하지 않거나 만료된 코드입니다." });
    }

    res.json({ 
      accessToken: tokenData.accessToken, 
      refreshToken: tokenData.refreshToken 
    });
  });
}
