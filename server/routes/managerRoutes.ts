import type { Express, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AdminStorage } from "../storage/adminStorage";
import { adminMatchStorage } from "../storage/adminMatchStorage";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyAccessToken } from "../utils/jwt";
import { broadcastManager } from "../liveMatch/broadcastManager";
import { startRound, stopRound, cancelStartRound, cancelStopRound, updateRoundPredictionResult, advanceToNextBatter, advancePitcherChange, advanceInningHalf, getMatchOverallStatistics, assertRoundResultSentOrAllowAdvance, incrementOutsInHalfOnResult } from "../liveMatch/predictionStorage";
import { buildGamePhasePayload } from "../liveMatch/gamePhase";
import { hasActiveSession, createSession, deleteSession, refreshSession, hasLogoutPermission, revokeLogoutPermission } from "../sessionManager";
import { ensureOperatorsReady, peekLoginLinkToken, resolveLoginLinkToken, assertOperatorLoginAllowed, isOperatorCredentialsActive, OPERATOR_USERNAMES } from "../managerOperatorService";
import { resolveClientLoginGeo } from "../utils/clientGeo";

const adminStorage = new AdminStorage();
const MANAGER_APP_SCHEME = "ppamongmanager";
const MANAGER_APP_PACKAGE = "com.ppamong.manager";

/** 이미 다른 곳에서 로그인 중 — 새 로그인 거부 */
export class ManagerSessionActiveError extends Error {
  constructor(message = "다른 기기에서 이미 로그인 중입니다. 해당 기기에서 로그아웃한 뒤 다시 시도하세요.") {
    super(message);
    this.name = "ManagerSessionActiveError";
  }
}

function getManagerAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return req.cookies?.managerAccessToken || null;
}

function clearManagerAuthCookies(res: Response): void {
  res.clearCookie("managerAccessToken", { path: "/" });
  res.clearCookie("managerRefreshToken", { path: "/" });
}

async function establishManagerSession(
  req: Request,
  res: Response,
  manager: { id: string; email: string; userType: string; approvalStatus: string },
): Promise<{ accessToken: string; refreshToken: string }> {
  const hasSession = await hasActiveSession("manager", manager.id);
  if (hasSession) {
    const sameClient =
      isRequestAlreadyThisManager(req, manager.id) ||
      (await (async () => {
        const refreshTok = req.cookies?.managerRefreshToken || req.body?.refreshToken;
        if (!refreshTok || typeof refreshTok !== "string") return false;
        try {
          const decoded = verifyRefreshToken(refreshTok);
          return decoded.adminId === manager.id && decoded.userType === "매니저";
        } catch {
          return false;
        }
      })());

    if (!sameClient) {
      console.log(`[Manager Login] 기존 세션 존재 — 로그인 거부: ${manager.id}`);
      throw new ManagerSessionActiveError();
    }
    console.log(`[Manager Login] 동일 클라이언트 재로그인 허용: ${manager.id}`);
  }

  const tokenPayload = {
    adminId: manager.id,
    email: manager.email,
    userType: manager.userType,
    approvalStatus: manager.approvalStatus,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  try {
    await createSession("manager", manager.id, {
      email: manager.email,
      userType: manager.userType,
    });

    const { ip, region } = await resolveClientLoginGeo(req);
    await adminStorage.updateAdminUser(manager.id, {
      lastLogin: new Date(),
      lastLoginIp: ip,
      lastLoginRegion: region,
    } as Parameters<AdminStorage["updateAdminUser"]>[1]);
  } catch (error) {
    try {
      await deleteSession("manager", manager.id);
    } catch (cleanupError) {
      console.error("Failed to cleanup session after login failure:", cleanupError);
    }
    throw error;
  }

  res.cookie("managerAccessToken", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("managerRefreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return { accessToken, refreshToken };
}

function isRequestAlreadyThisManager(req: Request, managerId: string): boolean {
  const access = getManagerAccessToken(req);
  if (!access) return false;
  try {
    const decoded = verifyAccessToken(access);
    return decoded.adminId === managerId && decoded.userType === "매니저";
  } catch {
    return false;
  }
}

function generateManagerLoginLinkBridgeHtml(token: string, origin: string): string {
  const webFallbackUrl = `${origin}/manager/login?t=${encodeURIComponent(token)}`;
  const deeplink = `${MANAGER_APP_SCHEME}://login?t=${encodeURIComponent(token)}`;
  const intentUrl =
    `intent://login?t=${encodeURIComponent(token)}#Intent;` +
    `scheme=${MANAGER_APP_SCHEME};package=${MANAGER_APP_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(webFallbackUrl)};end`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>운영자 앱 로그인</title>
  <style>
    body {
      background: #111;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
      text-align: center;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #333;
      border-top-color: #CDFF00;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .message { font-size: 16px; color: #ccc; line-height: 1.5; }
    .fallback {
      margin-top: 28px;
      display: inline-block;
      padding: 12px 20px;
      background: #CDFF00;
      color: #111;
      text-decoration: none;
      font-weight: 700;
      border-radius: 10px;
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <div class="message">운영자 앱으로 이동 중입니다...<br>앱이 열리면 자동으로 로그인됩니다.</div>
  <a class="fallback" href="${webFallbackUrl}">앱이 열리지 않으면 여기를 누르세요</a>
  <script>
    (function () {
      var deeplink = ${JSON.stringify(deeplink)};
      var intentUrl = ${JSON.stringify(intentUrl)};
      var webFallback = ${JSON.stringify(webFallbackUrl)};
      var ua = navigator.userAgent || "";
      var isKakaoInApp = /KAKAOTALK/i.test(ua);

      // 카카오톡 인앱 브라우저는 커스텀 스킴이 막히므로 웹 로그인으로 바로 이동
      if (isKakaoInApp) {
        window.location.replace(webFallback);
        return;
      }

      var isIOS = /iPhone|iPad|iPod/i.test(ua);
      if (isIOS) {
        window.location.href = deeplink;
      } else {
        window.location.href = intentUrl;
      }

      // 앱 미설치·인앱 차단 시 웹 로그인 폴백
      setTimeout(function () {
        window.location.replace(webFallback);
      }, 2200);
    })();
  </script>
</body>
</html>`;
}

export async function managerRoutes(app: Express): Promise<void> {
  // 운영자 회원가입 — 관리자 발급 계정만 사용
  app.post("/api/manager/signup", async (_req, res) => {
    return res.status(403).json({
      error: "운영자 계정은 관리자가 발급합니다. 발급받은 아이디와 비밀번호로 로그인하세요.",
    });
  });

  // 카톡 등에서 HTTPS 링크 클릭 → 운영자 앱 딥링크 시도 → 웹 폴백
  app.get("/api/manager/login-link/:token", async (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      if (!token || token.length < 16 || token.length > 128) {
        return res.status(400).type("html").send(
          "<!DOCTYPE html><html><body><p>유효하지 않은 로그인 링크입니다.</p></body></html>",
        );
      }
      const origin =
        process.env.NODE_ENV === "production"
          ? "https://ppamong.com"
          : `${req.protocol}://${req.get("host") || "localhost:5000"}`;
      res
        .status(200)
        .type("html")
        .set("Cache-Control", "no-store")
        .send(generateManagerLoginLinkBridgeHtml(token, origin));
    } catch (error) {
      console.error("Manager login-link bridge error:", error);
      return res.status(500).type("html").send(
        "<!DOCTYPE html><html><body><p>로그인 링크 처리 중 오류가 발생했습니다.</p></body></html>",
      );
    }
  });

  // 로그인 링크 미리보기 (토큰 소비 없음 — 로딩 화면 문구용)
  app.get("/api/manager/login-link-preview/:token", async (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      const preview = await peekLoginLinkToken(token);
      return res.json(preview);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "로그인 링크를 확인할 수 없습니다.";
      return res.status(401).json({ error: message });
    }
  });

  // 로그인 링크로 세션 발급 (링크·비밀번호는 담당 경기 종료 전까지 재사용)
  app.post("/api/manager/login-with-link", async (req, res) => {
    try {
      await ensureOperatorsReady();
      const token = typeof req.body?.token === "string" ? req.body.token : "";
      if (!token.trim()) {
        return res.status(400).json({ error: "로그인 토큰이 필요합니다." });
      }

      let resolved;
      try {
        resolved = await resolveLoginLinkToken(token);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "로그인에 실패했습니다.";
        const deactivated = message.includes("비활성화");
        return res.status(401).json({ error: message, deactivated });
      }

      let accessToken: string;
      let refreshToken: string;
      try {
        ({ accessToken, refreshToken } = await establishManagerSession(req, res, {
          id: resolved.managerId,
          email: resolved.email,
          userType: resolved.userType,
          approvalStatus: resolved.approvalStatus,
        }));
      } catch (sessionError) {
        if (sessionError instanceof ManagerSessionActiveError) {
          return res.status(409).json({
            error: sessionError.message,
            sessionActive: true,
          });
        }
        console.error("Manager login-with-link session error:", sessionError);
        return res.status(500).json({
          error: "로그인 세션을 만들지 못했습니다. 잠시 후 같은 링크로 다시 시도해 주세요.",
        });
      }

      return res.json({
        success: true,
        message: "로그인 성공",
        accessToken,
        refreshToken,
        username: resolved.username,
        assignedMatchNumber: resolved.assignedMatchNumber,
        operatorSlot: resolved.operatorSlot,
      });
    } catch (error) {
      console.error("Manager login-with-link error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 매니저 로그인
  app.post("/api/manager/login", async (req, res) => {
    try {
      await ensureOperatorsReady();

      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "이메일 또는 아이디와 비밀번호를 입력해주세요." });
      }

      let manager = await adminStorage.getAdminUserByEmail(email);
      if (!manager) {
        manager = await adminStorage.getAdminUserByUsername(email);
      }

      if (!manager) {
        return res.status(401).json({ error: "이메일 또는 비밀번호가 일치하지 않습니다." });
      }

      // 매니저 타입 확인
      if (manager.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 계정이 아닙니다." });
      }

      // 승인 상태 확인
      if (manager.approvalStatus !== "승인") {
        return res.status(403).json({ error: "계정이 승인되지 않았습니다." });
      }

      // 비활성화 상태 확인
      if (manager.status === "비활성화") {
        return res.status(403).json({ error: "비활성화된 계정입니다. 관리자에게 문의하세요.", deactivated: true });
      }

      if (OPERATOR_USERNAMES.includes(manager.username as (typeof OPERATOR_USERNAMES)[number])) {
        try {
          await assertOperatorLoginAllowed({
            id: manager.id,
            username: manager.username,
            operatorSlot: (manager as { operatorSlot?: number }).operatorSlot,
          });
        } catch (credError: unknown) {
          const message =
            credError instanceof Error
              ? credError.message
              : "로그인 정보가 만료되었습니다. 관리자에게 새 정보를 요청하세요.";
          return res.status(401).json({ error: message });
        }
      }

      const isBcryptHash = manager.password.startsWith("$2b$") || manager.password.startsWith("$2a$");
      let passwordMatch = false;

      if (isBcryptHash) {
        passwordMatch = await bcrypt.compare(password, manager.password);
      } else {
        passwordMatch = password === manager.password;
        if (passwordMatch) {
          const hashedPassword = await bcrypt.hash(password, 10);
          await adminStorage.updateAdminUser(manager.id, { password: hashedPassword });
          console.log(`[Manager Login] 평문 비밀번호를 bcrypt로 자동 변환: ${manager.email}`);
        }
      }

      if (!passwordMatch) {
        return res.status(401).json({ error: "이메일 또는 비밀번호가 일치하지 않습니다." });
      }

      const { accessToken, refreshToken } = await establishManagerSession(req, res, {
        id: manager.id,
        email: manager.email,
        userType: manager.userType,
        approvalStatus: manager.approvalStatus,
      });

      return res.json({
        success: true,
        message: "로그인 성공",
        accessToken,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof ManagerSessionActiveError) {
        return res.status(409).json({
          error: error.message,
          sessionActive: true,
        });
      }
      console.error("Manager login error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // Refresh token으로 access token 재발급
  app.post("/api/manager/refresh", async (req, res) => {
    try {
      // Body에서 먼저 확인, 없으면 쿠키에서 확인 (모바일 앱 호환)
      const refreshToken = req.body?.refreshToken || req.cookies?.managerRefreshToken;

      if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token이 없습니다." });
      }

      const decoded = verifyRefreshToken(refreshToken);

      if (!decoded) {
        return res.status(401).json({ error: "유효하지 않은 refresh token입니다." });
      }

      // 매니저 타입 확인
      if (decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 계정이 아닙니다." });
      }

      // 매니저 정보 조회하여 계정 상태 확인 (비활성화된 매니저 차단)
      const manager = await adminStorage.getAdminUserById(decoded.adminId);
      if (!manager) {
        res.clearCookie("managerAccessToken", { path: "/" });
        res.clearCookie("managerRefreshToken", { path: "/" });
        return res.status(401).json({ error: "매니저 계정을 찾을 수 없습니다." });
      }

      if (manager.approvalStatus !== "승인") {
        res.clearCookie("managerAccessToken", { path: "/" });
        res.clearCookie("managerRefreshToken", { path: "/" });
        return res.status(403).json({ error: "승인되지 않은 계정입니다." });
      }

      if (manager.status === "비활성화") {
        res.clearCookie("managerAccessToken", { path: "/" });
        res.clearCookie("managerRefreshToken", { path: "/" });
        return res.status(403).json({ error: "비활성화된 계정입니다.", deactivated: true });
      }

      if (!(await isOperatorCredentialsActive(manager.id))) {
        await deleteSession("manager", manager.id);
        res.clearCookie("managerAccessToken", { path: "/" });
        res.clearCookie("managerRefreshToken", { path: "/" });
        return res.status(401).json({
          error: "담당 경기가 종료되어 로그인이 만료되었습니다.",
          matchEnded: true,
        });
      }

      const sessionExists = await hasActiveSession("manager", decoded.adminId);
      if (!sessionExists) {
        clearManagerAuthCookies(res);
        return res.status(401).json({
          error: "세션이 만료되었거나 다른 곳에서 종료되었습니다. 다시 로그인해 주세요.",
          sessionExpired: true,
        });
      }

      await refreshSession("manager", decoded.adminId).catch(() => {});

      // 새 토큰 생성
      const tokenPayload = {
        adminId: decoded.adminId,
        email: decoded.email,
        userType: decoded.userType,
        approvalStatus: decoded.approvalStatus,
      };

      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      // 새 토큰을 쿠키에 저장 (모바일 앱을 위해 sameSite: "none" 사용)
      res.cookie("managerAccessToken", newAccessToken, {
        httpOnly: true,
        secure: true, // sameSite: "none"은 secure: true 필수
        sameSite: "none",
        path: "/", // WebSocket 연결 시 쿠키 전송을 위해 루트 경로로 설정
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("managerRefreshToken", newRefreshToken, {
        httpOnly: true,
        secure: true, // sameSite: "none"은 secure: true 필수
        sameSite: "none",
        path: "/", // WebSocket 연결 시 쿠키 전송을 위해 루트 경로로 설정
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
      });

      return res.json({ 
        success: true, 
        message: "토큰이 갱신되었습니다.",
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      console.error("Manager refresh error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 로그아웃 - BO에서 로그아웃 권한이 부여된 경우에만 허용
  app.post("/api/manager/logout", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);
      if (!accessToken) {
        return res.status(401).json({ error: "인증이 필요합니다." });
      }
      const decoded = verifyAccessToken(accessToken);
      if (!decoded || decoded.userType !== "매니저") {
        return res.status(401).json({ error: "유효하지 않은 토큰입니다." });
      }
      const managerId = decoded.adminId;

      const permitted = await hasLogoutPermission("manager", managerId);
      if (!permitted) {
        return res.status(403).json({ 
          error: "관리자의 로그아웃 허가가 필요합니다." 
        });
      }

      await deleteSession("manager", managerId);
      await revokeLogoutPermission("manager", managerId);

      try {
        const { AdminUserModel } = await import("../UserStorage/db");
        await AdminUserModel.updateOne({ id: managerId }, { lastLogout: new Date() });
      } catch (dbError) {
        console.error("[Manager Logout] DB 업데이트 실패:", dbError);
      }

      res.clearCookie("managerAccessToken", { path: "/" });
      res.clearCookie("managerRefreshToken", { path: "/" });
      res.json({ message: "로그아웃 성공" });
    } catch (error) {
      console.error("[Manager Logout] 오류:", error);
      res.status(500).json({ error: "로그아웃 처리 중 오류가 발생했습니다." });
    }
  });

  app.post("/api/manager/clear-session", (_req, res) => {
    res.clearCookie("managerAccessToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
    res.clearCookie("managerRefreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
    return res.json({ success: true });
  });

  // 현재 로그인한 매니저 정보 조회
  app.get("/api/manager/me", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);

      if (!accessToken) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      const decoded = verifyAccessToken(accessToken);

      if (!decoded) {
        return res.status(401).json({ error: "유효하지 않은 토큰입니다." });
      }

      // 매니저 타입 확인
      if (decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 계정이 아닙니다." });
      }

      const manager = await adminStorage.getAdminUserById(decoded.adminId);

      if (!manager) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      if (!(await isOperatorCredentialsActive(manager.id))) {
        await deleteSession("manager", manager.id);
        res.clearCookie("managerAccessToken", { path: "/" });
        res.clearCookie("managerRefreshToken", { path: "/" });
        return res.status(401).json({
          error: "담당 경기가 종료되어 로그인이 만료되었습니다.",
          matchEnded: true,
        });
      }

      // 비밀번호 제외하고 반환 (클라이언트가 { manager: ... } 형태를 기대함)
      const { password, ...managerWithoutPassword } = manager;

      return res.json({ manager: managerWithoutPassword });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Manager me error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 아이디 중복 확인
  app.post("/api/manager/check-username", async (req, res) => {
    try {
      const { username } = req.body;

      if (!username) {
        return res.status(400).json({ message: "아이디를 입력해주세요." });
      }

      const existingAdmin = await adminStorage.getAdminUserByUsername(username, true);

      if (existingAdmin) {
        return res.json({ 
          available: false, 
          message: "이미 사용 중인 아이디입니다." 
        });
      }

      return res.json({ 
        available: true, 
        message: "사용 가능한 아이디입니다." 
      });
    } catch (error) {
      console.error("Manager check-username error:", error);
      return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
  });

  // 오늘의 경기 목록 조회 (매니저에게 할당된 경기만)
  app.get("/api/manager/matches/today", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);

      if (!accessToken) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      const decoded = verifyAccessToken(accessToken);

      if (!decoded || decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 권한이 필요합니다." });
      }

      const manager = await adminStorage.getAdminUserById(decoded.adminId);
      if (manager?.status === "비활성화") {
        return res.json([]);
      }

      const matches = await adminMatchStorage.getTodayMatchesByManager(decoded.adminId);
      return res.json(matches);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Get today's matches error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 경기 상세 조회 (매니저에게 할당된 경기만)
  app.get("/api/manager/matches/:id", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);

      if (!accessToken) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      const decoded = verifyAccessToken(accessToken);

      if (!decoded || decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 권한이 필요합니다." });
      }

      const manager = await adminStorage.getAdminUserById(decoded.adminId);
      if (manager?.status === "비활성화") {
        return res.status(403).json({ error: "비활성화된 계정입니다. 경기 진행이 불가합니다.", deactivated: true });
      }

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);

      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      return res.json({
        ...match,
        gamePhase: buildGamePhasePayload(match as Parameters<typeof buildGamePhasePayload>[0]),
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Get match detail error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 예측 시작 (매니저 전용)
  app.post("/api/manager/matches/:id/prediction/start", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);

      if (!accessToken) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      const decoded = verifyAccessToken(accessToken);

      if (!decoded || decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 권한이 필요합니다." });
      }

      const { id } = req.params;
      
      // 경기가 매니저에게 할당되었는지 확인
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      // 대기 중인 광고 타이머 취소 및 광고 무조건 중지
      broadcastManager.clearAdTimer(id);
      broadcastManager.setAdPlaying(id, false);
      broadcastManager.sendToMatch(id, "ad_stopped", {
        matchId: id,
        message: "광고가 중지되었습니다."
      });

      // startRound 호출로 predictionEnabled true 설정 (라운드 증가 없음)
      const updatedMatch = await startRound(id);

      // SSE로 예측 시작 이벤트 전송
      broadcastManager.sendToMatch(id, "prediction_started", {
        matchId: id,
        currentRound: updatedMatch.currentRound,
        message: `라운드 ${updatedMatch.currentRound} 예측이 시작되었습니다.`
      });

      return res.json({ 
        success: true, 
        message: "예측이 시작되었습니다.",
        currentRound: updatedMatch.currentRound 
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Start prediction error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 예측 중지 (매니저 전용)
  app.post("/api/manager/matches/:id/prediction/stop", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);

      if (!accessToken) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      const decoded = verifyAccessToken(accessToken);

      if (!decoded || decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 권한이 필요합니다." });
      }

      const { id } = req.params;
      
      // 경기가 매니저에게 할당되었는지 확인
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      // stopRound 호출로 predictionEnabled false 설정
      const updatedMatch = await stopRound(id);

      // SSE로 예측 중지 이벤트 전송
      broadcastManager.sendToMatch(id, "prediction_stopped", {
        matchId: id,
        currentRound: updatedMatch.currentRound,
        message: "예측이 중지되었습니다."
      });

      return res.json({ success: true, message: "예측이 중지되었습니다." });
    } catch (error: any) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Stop prediction error:", error);
      const message = error?.message || "";
      if (message.includes("시작되지 않았습니다") || message.includes("이미 중지되었습니다")) {
        return res.status(400).json({ error: message });
      }
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.post("/api/manager/matches/:id/prediction/cancel-start", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);
      if (!accessToken) return res.status(401).json({ error: "로그인이 필요합니다." });

      const decoded = verifyAccessToken(accessToken);
      if (!decoded || decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 권한이 필요합니다." });
      }

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      const updatedMatch = await cancelStartRound(id);

      broadcastManager.sendToMatch(id, "prediction_cancelled", {
        matchId: id,
        currentRound: updatedMatch.currentRound,
        message: "예측 시작이 취소되었습니다.",
      });

      return res.json({
        success: true,
        message: "예측 시작이 취소되었습니다.",
        currentRound: updatedMatch.currentRound,
      });
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      const message = error instanceof Error ? error.message : "예측 시작 취소에 실패했습니다.";
      return res.status(400).json({ error: message });
    }
  });

  app.post("/api/manager/matches/:id/prediction/cancel-stop", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);
      if (!accessToken) return res.status(401).json({ error: "로그인이 필요합니다." });

      const decoded = verifyAccessToken(accessToken);
      if (!decoded || decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 권한이 필요합니다." });
      }

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      const updatedMatch = await cancelStopRound(id);

      broadcastManager.sendToMatch(id, "prediction_started", {
        matchId: id,
        currentRound: updatedMatch.currentRound,
        message: `라운드 ${updatedMatch.currentRound} 예측이 다시 시작되었습니다.`,
      });

      return res.json({
        success: true,
        message: "예측 중지가 취소되었습니다.",
        currentRound: updatedMatch.currentRound,
      });
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      const message = error instanceof Error ? error.message : "예측 중지 취소에 실패했습니다.";
      return res.status(400).json({ error: message });
    }
  });

  // 예측 결과 전송 (매니저 전용)
  app.post("/api/manager/matches/:id/result", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);

      if (!accessToken) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      const decoded = verifyAccessToken(accessToken);

      if (!decoded || decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 권한이 필요합니다." });
      }

      const { id } = req.params;
      const { result } = req.body;

      if (!result) {
        return res.status(400).json({ error: "결과가 필요합니다." });
      }

      // 경기가 매니저에게 할당되었는지 확인
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      // 예측이 아직 진행 중이면 결과 전송 거부 (먼저 예측 중지해야 함)
      if (match.predictionEnabled) {
        return res.status(400).json({ error: "예측을 먼저 중지해 주세요." });
      }

      // 예측 결과 업데이트 (포인트 지급 포함) - 유저별 wonAmount 맵 반환
      const userWonAmounts = await updateRoundPredictionResult(id, match.currentRound, result);
      const { outsInHalf, threeOutsReached } = await incrementOutsInHalfOnResult(id, result);

      // 유저별 wonAmount를 포함한 개인화된 round_result 전송
      const userDataMap = new Map<string, any>();
      userWonAmounts.forEach((wonAmount, userId) => {
        userDataMap.set(userId, { wonAmount });
      });

      broadcastManager.sendToMatchWithUserData(id, "round_result", {
        matchId: id,
        roundNumber: match.currentRound,
        result,
        message: `라운드 ${match.currentRound} 결과: ${result}`
      }, userDataMap);

      // 결과 전송 후 자동으로 다음 타자(라운드)로 이동
      let nextRoundNumber = match.currentRound;
      try {
        const { match: updatedMatch } = await advanceToNextBatter(id);
        nextRoundNumber = updatedMatch.currentRound;
        const gamePhase = buildGamePhasePayload(updatedMatch as typeof match);

        broadcastManager.sendToMatch(id, "round_next", {
          matchId: id,
          currentRound: updatedMatch.currentRound,
          predictionEnabled: updatedMatch.predictionEnabled,
          advanceType: "next_batter",
          gamePhase,
          message: `라운드 ${updatedMatch.currentRound}으로 이동했습니다.`,
        });

        broadcastManager.sendToMatch(id, "banner_ad_show", {
          matchId: id,
          message: "타자 교체 배너 광고를 표시합니다.",
        });
      } catch (nextRoundError) {
        console.error("Auto next round failed after result:", nextRoundError);
      }

      return res.json({ 
        success: true, 
        message: "결과가 전송되었습니다.",
        roundNumber: match.currentRound,
        result,
        nextRound: nextRoundNumber,
        outsInHalf,
        threeOutsReached,
        adStarted: false,
        adDelaySeconds: 0
      });
    } catch (error: any) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Submit result error:", error);
      const message = error?.message || "";
      if (message.includes("이미 전송되었습니다") || message.includes("시작되지 않았습니다") || message.includes("중지되지 않았습니다")) {
        return res.status(400).json({ error: message });
      }
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 다음 타자 (매니저 전용)
  app.post("/api/manager/control/:id/round/next-batter", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);
      if (!accessToken) return res.status(401).json({ error: "로그인이 필요합니다." });

      const decoded = verifyAccessToken(accessToken);
      if (!decoded || decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 권한이 필요합니다." });
      }

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      await assertRoundResultSentOrAllowAdvance(id, match.currentRound);

      const { match: updatedMatch, predictionAutoStopped } = await advanceToNextBatter(id);
      const overallStats = await getMatchOverallStatistics(id);
      const gamePhase = buildGamePhasePayload(updatedMatch as typeof match);

      if (predictionAutoStopped) {
        broadcastManager.sendToMatch(id, "prediction_stopped", {
          matchId: id,
          currentRound: updatedMatch.currentRound - 1,
          stoppedRound: updatedMatch.currentRound - 1,
          message: "투수 교체로 예측이 자동 중지되었습니다.",
        });
      }

      broadcastManager.clearAdTimer(id);
      if (broadcastManager.isAdPlaying(id)) {
        broadcastManager.setAdPlaying(id, false);
        broadcastManager.sendToMatch(id, "ad_stopped", {
          matchId: id,
          message: "라운드 전환으로 광고가 중지되었습니다.",
        });
      }

      broadcastManager.sendToMatch(id, "round_next", {
        matchId: id,
        currentRound: updatedMatch.currentRound,
        predictionEnabled: updatedMatch.predictionEnabled,
        overallStats,
        advanceType: "next_batter",
        gamePhase,
        message: `다음 타자(라운드 ${updatedMatch.currentRound})`,
      });

      broadcastManager.sendToMatch(id, "banner_ad_show", {
        matchId: id,
        message: "타자 교체 배너 광고를 표시합니다.",
      });

      return res.json({
        success: true,
        message: "다음 타자로 이동했습니다.",
        currentRound: updatedMatch.currentRound,
        gamePhase,
        predictionAutoStopped,
      });
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Next batter error:", error);
      const message = error instanceof Error ? error.message : "다음 타자 이동에 실패했습니다.";
      if (message.includes("결과를 전송")) {
        return res.status(400).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  // 투수 교체 (매니저 전용) — 타순 유지, 라운드만 진행
  app.post("/api/manager/control/:id/round/pitcher-change", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);
      if (!accessToken) return res.status(401).json({ error: "로그인이 필요합니다." });

      const decoded = verifyAccessToken(accessToken);
      if (!decoded || decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 권한이 필요합니다." });
      }

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      const { match: updatedMatch, predictionAutoStopped } = await advancePitcherChange(id);
      const overallStats = await getMatchOverallStatistics(id);
      const gamePhase = buildGamePhasePayload(updatedMatch as typeof match);

      if (predictionAutoStopped) {
        broadcastManager.sendToMatch(id, "prediction_stopped", {
          matchId: id,
          currentRound: updatedMatch.currentRound - 1,
          stoppedRound: updatedMatch.currentRound - 1,
          message: "투수 교체로 예측이 자동 중지되었습니다.",
        });
      }

      broadcastManager.clearAdTimer(id);
      if (broadcastManager.isAdPlaying(id)) {
        broadcastManager.setAdPlaying(id, false);
        broadcastManager.sendToMatch(id, "ad_stopped", {
          matchId: id,
          message: "라운드 전환으로 광고가 중지되었습니다.",
        });
      }

      broadcastManager.sendToMatch(id, "round_next", {
        matchId: id,
        currentRound: updatedMatch.currentRound,
        predictionEnabled: updatedMatch.predictionEnabled,
        overallStats,
        advanceType: "pitcher_change",
        gamePhase,
        message: `투수 교체 — ${gamePhase.displayLabel}`,
      });

      broadcastManager.sendToMatch(id, "banner_ad_show", {
        matchId: id,
        message: "투수 교체 배너 광고를 표시합니다.",
      });

      return res.json({
        success: true,
        message: "투수 교체가 반영되었습니다.",
        currentRound: updatedMatch.currentRound,
        gamePhase,
        predictionAutoStopped,
      });
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Pitcher change error:", error);
      const message = error instanceof Error ? error.message : "투수 교체 처리에 실패했습니다.";
      if (message.includes("결과") || message.includes("예측")) {
        return res.status(400).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  // 공수교대 (매니저 전용)
  app.post("/api/manager/control/:id/round/switch-half", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);
      if (!accessToken) return res.status(401).json({ error: "로그인이 필요합니다." });

      const decoded = verifyAccessToken(accessToken);
      if (!decoded || decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 권한이 필요합니다." });
      }

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      await assertRoundResultSentOrAllowAdvance(id, match.currentRound);

      const { match: updatedMatch, predictionAutoStopped } = await advanceInningHalf(id);
      const overallStats = await getMatchOverallStatistics(id);
      const gamePhase = buildGamePhasePayload(updatedMatch as typeof match);

      if (predictionAutoStopped) {
        broadcastManager.sendToMatch(id, "prediction_stopped", {
          matchId: id,
          currentRound: updatedMatch.currentRound - 1,
          stoppedRound: updatedMatch.currentRound - 1,
          message: "공수교대로 예측이 자동 중지되었습니다.",
        });
      }

      broadcastManager.clearAdTimer(id);
      if (broadcastManager.isAdPlaying(id)) {
        broadcastManager.setAdPlaying(id, false);
        broadcastManager.sendToMatch(id, "ad_stopped", {
          matchId: id,
          message: "라운드 전환으로 광고가 중지되었습니다.",
        });
      }

      broadcastManager.sendToMatch(id, "round_next", {
        matchId: id,
        currentRound: updatedMatch.currentRound,
        predictionEnabled: updatedMatch.predictionEnabled,
        overallStats,
        advanceType: "switch_half",
        gamePhase,
        message: `공수교대 — ${gamePhase.displayLabel}`,
      });

      broadcastManager.sendToMatch(id, "banner_ad_show", {
        matchId: id,
        message: "공수교대 배너 광고를 표시합니다.",
      });

      return res.json({
        success: true,
        message: "공수교대가 반영되었습니다.",
        currentRound: updatedMatch.currentRound,
        gamePhase,
        adStarted: true,
        predictionAutoStopped,
      });
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Switch half error:", error);
      const message = error instanceof Error ? error.message : "공수교대 처리에 실패했습니다.";
      if (message.includes("결과를 전송")) {
        return res.status(400).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  // 광고 시작 (매니저 전용)
  app.post("/api/manager/matches/:id/ad/start", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);

      if (!accessToken) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      const decoded = verifyAccessToken(accessToken);

      if (!decoded || decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 권한이 필요합니다." });
      }

      const { id } = req.params;
      
      // 경기가 매니저에게 할당되었는지 확인
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      // 광고 상태 업데이트
      broadcastManager.setAdPlaying(id, true);
      const matchState = broadcastManager.getMatchState(id);

      // SSE로 광고 시작 이벤트 전송
      broadcastManager.sendToMatch(id, "ad_started", {
        matchId: id,
        message: "광고가 시작되었습니다.",
        adStartedAt: matchState.adStartedAt,
      });

      return res.json({ 
        success: true, 
        message: "광고가 시작되었습니다."
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Start ad error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 광고 중지 (매니저 전용)
  app.post("/api/manager/matches/:id/ad/stop", async (req, res) => {
    try {
      const accessToken = getManagerAccessToken(req);

      if (!accessToken) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      const decoded = verifyAccessToken(accessToken);

      if (!decoded || decoded.userType !== "매니저") {
        return res.status(403).json({ error: "매니저 권한이 필요합니다." });
      }

      const { id } = req.params;
      
      // 경기가 매니저에게 할당되었는지 확인
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      // 광고 상태 업데이트
      broadcastManager.setAdPlaying(id, false);

      // SSE로 광고 중지 이벤트 전송
      broadcastManager.sendToMatch(id, "ad_stopped", {
        matchId: id,
        message: "광고가 중지되었습니다."
      });

      return res.json({ 
        success: true, 
        message: "광고가 중지되었습니다."
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Stop ad error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
