import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AdminStorage } from "../storage/adminStorage";
import { adminMatchStorage } from "../storage/adminMatchStorage";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyAccessToken, type TokenPayload } from "../utils/jwt";
import { broadcastManager } from "../liveMatch/broadcastManager";
import { startRound, stopRound, cancelStartRound, cancelStopRound, updateRoundPredictionResult, advanceToNextBatter, advancePitcherChange, advanceInningHalf, getMatchOverallStatistics, assertRoundResultSentOrAllowAdvance, incrementOutsInHalfOnResult, ensureMatchLiveForOperatorControls } from "../liveMatch/predictionStorage";
import { assertSwitchHalfNotDuringAd } from "../liveMatch/switchHalfAdGuard";
import { buildGamePhasePayload } from "../liveMatch/gamePhase";
import { syncAtBatPhaseAfterManual } from "../liveMatch/atBatStateMachine";
import { notifyManualAtBatAction, schedulePredictionAutoStop } from "../liveMatch/liveAutoOperator";
import { MatchModel } from "../UserStorage/db";
import { patchMatchLiveScoreboard } from "../apiSports/syncService";
import { saveManualMatchLineup } from "../apiSports/manualLineupService";
import { clearMatchPinchHitter, setMatchPinchHitter } from "../apiSports/pinchHitterService";
import { listKboPlayers, resolveMatchTeamShort } from "../kboRoster/kboRosterService";
import { z } from "zod";
import { hasActiveSession, createSession, deleteSession, refreshSession, hasLogoutPermission, revokeLogoutPermission } from "../sessionManager";
import { ensureOperatorsReady, peekLoginLinkToken, resolveLoginLinkToken, isOperatorCredentialsActive } from "../managerOperatorService";
import { resolveClientLoginGeo } from "../utils/clientGeo";
import { canAccessPpamongOperator } from "../utils/managerPlatform";
import {
  PPAMONG_OPERATOR_LINK_ONLY,
  PPAMONG_OPERATOR_LOGIN_DENIED,
} from "../../shared/operatorLoginPolicy";
import { operatorControlErrorStatus } from "../../shared/operatorControlError";

const adminStorage = new AdminStorage();
const MANAGER_APP_SCHEME = "ppamongmanager";
const MANAGER_APP_PACKAGE = "com.ppamong.manager";

/** 경기전(scheduled)에는 예측·진행 컨트롤 불가 — 시작 5분 전부터 허용, 시작 시각 이후면 ongoing 승격 */
async function assertMatchLiveForControls(matchId: string): Promise<void> {
  await ensureMatchLiveForOperatorControls(matchId);
}

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

/** Bearer/쿠키 토큰 + 빠몽 운영자(op1~op5) 여부 검증 */
async function requirePpamongOperatorAuth(req: Request, res: Response): Promise<TokenPayload | null> {
  const accessToken = getManagerAccessToken(req);
  if (!accessToken) {
    res.status(401).json({ error: "로그인이 필요합니다." });
    return null;
  }

  let decoded: TokenPayload;
  try {
    decoded = verifyAccessToken(accessToken);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "인증이 만료되었습니다." });
    } else {
      res.status(401).json({ error: "유효하지 않은 토큰입니다." });
    }
    return null;
  }

  if (decoded.userType !== "매니저") {
    res.status(403).json({ error: "매니저 권한이 필요합니다." });
    return null;
  }

  const manager = await adminStorage.getAdminUserById(decoded.adminId);
  if (!manager || !canAccessPpamongOperator(manager.username, manager.userType)) {
    res.status(403).json({ error: PPAMONG_OPERATOR_LOGIN_DENIED });
    return null;
  }

  await refreshSession("manager", decoded.adminId).catch(() => {});
  return decoded;
}

function emitPinchCleared(matchId: string, pinchCleared: boolean) {
  if (!pinchCleared) return;
  broadcastManager.sendToMatch(matchId, "pinch_hitter_cleared", {
    matchId,
    message: "대타가 해제되었습니다.",
  });
}

/** 운영자 HTTP는 통계 집계를 기다리지 않음. 유저 round_next는 즉시, 모니터 통계는 이후 stats_update. */
function broadcastRoundNextThenStats(
  matchId: string,
  payload: {
    currentRound: number;
    predictionEnabled: boolean;
    advanceType: string;
    gamePhase: ReturnType<typeof buildGamePhasePayload>;
    message: string;
    skippedResult?: boolean;
  },
) {
  broadcastManager.sendToMatch(matchId, "round_next", {
    matchId,
    ...payload,
  });
  void getMatchOverallStatistics(matchId)
    .then((overallStats) => {
      broadcastManager.sendToMatch(matchId, "stats_update", {
        matchId,
        overallStats,
      });
    })
    .catch((error) => {
      console.error("[Manager] round advance stats_update failed:", error);
    });
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

      if (!canAccessPpamongOperator(resolved.username, resolved.userType)) {
        return res.status(403).json({ error: PPAMONG_OPERATOR_LOGIN_DENIED });
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

  // 아이디·비밀번호 로그인 — 빠몽 운영자 앱은 카톡 링크 전용
  app.post("/api/manager/login", async (_req, res) => {
    return res.status(403).json({ error: PPAMONG_OPERATOR_LINK_ONLY });
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
        return res.status(403).json({
          error: "담당 경기가 종료되었습니다.",
          deactivated: true,
          matchEnded: true,
        });
      }

      if (!canAccessPpamongOperator(manager.username, manager.userType)) {
        res.clearCookie("managerAccessToken", { path: "/" });
        res.clearCookie("managerRefreshToken", { path: "/" });
        return res.status(403).json({ error: PPAMONG_OPERATOR_LOGIN_DENIED });
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
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;
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
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

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
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

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
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const manager = await adminStorage.getAdminUserById(decoded.adminId);
      if (manager?.status === "비활성화") {
        return res.status(403).json({
          error: "담당 경기가 종료되었습니다.",
          deactivated: true,
          matchEnded: true,
        });
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
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      
      // 경기가 매니저에게 할당되었는지 확인
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }
      await assertMatchLiveForControls(id);

      // 대기 중인 광고 타이머 취소 및 전면광고 중지 (예측 시작 = 보상 없음)
      broadcastManager.stopAdPlaying(id, "prediction_start", "광고가 중지되었습니다.");

      // startRound 호출로 predictionEnabled true 설정 (라운드 증가 없음)
      const updatedMatch = await startRound(id);
      notifyManualAtBatAction(id, "start");
      schedulePredictionAutoStop(id);
      await syncAtBatPhaseAfterManual(id, "manual_start");

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
      const message = error instanceof Error ? error.message : "";
      if (
        message.includes("경기전에") ||
        message.includes("종료되어") ||
        message.includes("재시작할 수 없습니다") ||
        message.includes("3아웃") ||
        message.includes("다음 타자") ||
        message.includes("공수교대") ||
        message.includes("찾을 수 없습니다")
      ) {
        return res.status(400).json({ error: message });
      }
      // 운영자가 원인을 볼 수 있도록 메시지 전달 (트랜잭션/DB 오류 포함)
      return res.status(500).json({
        error: message || "예측 시작에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      });
    }
  });

  // 예측 중지 (매니저 전용)
  app.post("/api/manager/matches/:id/prediction/stop", async (req, res) => {
    try {
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      
      // 경기가 매니저에게 할당되었는지 확인
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }
      await assertMatchLiveForControls(id);

      const updatedMatch = await stopRound(id);
      if (!updatedMatch) {
        return res.status(404).json({ error: "경기를 찾을 수 없습니다." });
      }
      notifyManualAtBatAction(id, "stop");
      try {
        await syncAtBatPhaseAfterManual(id, "manual_stop");
      } catch (syncError) {
        console.error("Stop prediction phase sync error:", syncError);
      }

      broadcastManager.sendToMatch(id, "prediction_stopped", {
        matchId: id,
        currentRound: updatedMatch.currentRound,
        message: "예측이 중지되었습니다.",
      });

      return res.json({
        success: true,
        message: "예측이 중지되었습니다.",
        currentRound: updatedMatch.currentRound,
      });
    } catch (error: any) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Stop prediction error:", error);
      const message = error?.message || "";
      if (
        message.includes("시작되지 않았습니다") ||
        message.includes("이미 중지되었습니다") ||
        message.includes("경기를 찾을 수 없습니다") ||
        message.includes("경기전에") ||
        message.includes("종료되어")
      ) {
        return res.status(400).json({ error: message });
      }
      // 운영자가 원인을 볼 수 있도록 메시지 전달 (트랜잭션/DB 오류 포함)
      return res.status(500).json({
        error: message || "예측 중지에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      });
    }
  });

  app.post("/api/manager/matches/:id/prediction/cancel-start", async (req, res) => {
    try {
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      const updatedMatch = await cancelStartRound(id);
      notifyManualAtBatAction(id, "cancel");
      await syncAtBatPhaseAfterManual(id, "manual_cancel_start");

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
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      const updatedMatch = await cancelStopRound(id);
      notifyManualAtBatAction(id, "start");
      schedulePredictionAutoStop(id);
      await syncAtBatPhaseAfterManual(id, "manual_cancel_stop");

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
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      const { result, outsDelta: rawOutsDelta } = req.body;

      if (!result) {
        return res.status(400).json({ error: "결과가 필요합니다." });
      }

      const settleResult = result === "병살" || result === "삼살" ? "아웃" : result;
      let outsDelta: number | undefined;
      if (result === "병살") outsDelta = 2;
      else if (result === "삼살") outsDelta = 3;
      else if (typeof rawOutsDelta === "number" && rawOutsDelta >= 1 && rawOutsDelta <= 3) {
        outsDelta = Math.floor(rawOutsDelta);
      }

      // 경기가 매니저에게 할당되었는지 확인
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }
      await assertMatchLiveForControls(id);

      // 예측이 아직 진행 중이면 결과 전송 거부 (먼저 예측 중지해야 함)
      if (match.predictionEnabled) {
        return res.status(400).json({ error: "예측을 먼저 중지해 주세요." });
      }

      // 예측 결과 업데이트 (포인트 지급 포함) - 유저별 wonAmount 맵 반환
      // 병살·삼살 UI도 정산 결과는 반드시 "아웃"
      const userWonAmounts = await updateRoundPredictionResult(id, match.currentRound, settleResult);
      const { outsInHalf, threeOutsReached } = await incrementOutsInHalfOnResult(id, settleResult, {
        outsDelta,
      });

      const liveDoc = await MatchModel.findOne({ id }).select("liveScoreboard inningHalf").lean();
      const liveBoard = (
        liveDoc as {
          liveScoreboard?: { situation?: { outs?: number | null; atBatResultDisplay?: string | null }; inningHalf?: string | null };
          inningHalf?: string;
        } | null
      );
      const liveDisplay =
        liveBoard?.liveScoreboard?.situation?.atBatResultDisplay ?? null;
      const displayResult = (liveDisplay ?? "").trim() || (result === "병살" || result === "삼살" ? result : settleResult);

      // 유저별 wonAmount를 포함한 개인화된 round_result 전송
      const userDataMap = new Map<string, any>();
      userWonAmounts.forEach((wonAmount, userId) => {
        userDataMap.set(userId, { wonAmount });
      });

      broadcastManager.sendToMatchWithUserData(id, "round_result", {
        matchId: id,
        roundNumber: match.currentRound,
        result: settleResult,
        displayResult,
        outsDelta: outsDelta ?? (settleResult === "아웃" ? 1 : 0),
        message: `라운드 ${match.currentRound} 결과: ${displayResult}`
      }, userDataMap);

      notifyManualAtBatAction(id, "result");
      await syncAtBatPhaseAfterManual(id, "manual_result");

      // 결과 후 자동 다음타자·공수교대 없음 — 운영자가 「다음 타자」또는 「공수교대」를 누름
      return res.json({ 
        success: true, 
        message: threeOutsReached
          ? "결과가 전송되었습니다. 공수교대를 눌러주세요."
          : "결과가 전송되었습니다. 다음 타자를 눌러주세요.",
        roundNumber: match.currentRound,
        result: settleResult,
        displayResult: result,
        nextRound: match.currentRound,
        outsInHalf,
        threeOutsReached,
        awaitAdvance: true,
        adStarted: false,
        adDelaySeconds: 0
      });
    } catch (error: any) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Submit result error:", error);
      const message = error?.message || "";
      if (message.includes("이미 전송되었습니다") || message.includes("시작되지 않았습니다") || message.includes("중지되지 않았습니다") || message.includes("경기전에")) {
        return res.status(400).json({ error: message });
      }
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 다음 타자 (매니저 전용)
  app.post("/api/manager/control/:id/round/next-batter", async (req, res) => {
    try {
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }
      await assertMatchLiveForControls(id);

      if (match.showThreeOutsHint) {
        return res.status(400).json({ error: "3아웃입니다. 공수교대를 눌러주세요." });
      }

      await assertRoundResultSentOrAllowAdvance(id, match.currentRound);

      const { match: updatedMatch, pinchCleared } = await advanceToNextBatter(id);
      const gamePhase = buildGamePhasePayload(updatedMatch as typeof match);

      emitPinchCleared(id, pinchCleared);

      broadcastManager.clearAdTimer(id);
      if (broadcastManager.isAdPlaying(id)) {
        broadcastManager.stopAdPlaying(id, "round_advance", "라운드 전환으로 광고가 중지되었습니다.");
      }

      broadcastRoundNextThenStats(id, {
        currentRound: updatedMatch.currentRound,
        predictionEnabled: updatedMatch.predictionEnabled,
        advanceType: "next_batter",
        gamePhase,
        message: `다음 타자(라운드 ${updatedMatch.currentRound})`,
      });
      // 광고 시작 없음 — 전면광고는 공수교대·투수교체만
      notifyManualAtBatAction(id, "next");
      await syncAtBatPhaseAfterManual(id, "manual_next_batter");

      return res.json({
        success: true,
        message: "다음 타자로 이동했습니다.",
        currentRound: updatedMatch.currentRound,
        gamePhase,
        predictionAutoStopped: false,
        predictionStarted: false,
      });
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Next batter error:", error);
      const { status, message } = operatorControlErrorStatus(error);
      return res.status(status).json({
        error: status === 500 ? message || "다음 타자 이동에 실패했습니다." : message,
      });
    }
  });

  // 투수 교체 (매니저 전용) — 타순 유지, 라운드만 진행
  app.post("/api/manager/control/:id/round/pitcher-change", async (req, res) => {
    try {
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }
      await assertMatchLiveForControls(id);

      if (match.showThreeOutsHint) {
        return res.status(400).json({ error: "3아웃입니다. 공수교대를 눌러주세요." });
      }

      const { match: updatedMatch, predictionAutoStopped, skippedResult, pinchCleared } =
        await advancePitcherChange(id);
      const gamePhase = buildGamePhasePayload(updatedMatch as typeof match);

      emitPinchCleared(id, pinchCleared);

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
        broadcastManager.stopAdPlaying(id, "round_advance", "라운드 전환으로 광고가 중지되었습니다.");
      }

      broadcastRoundNextThenStats(id, {
        currentRound: updatedMatch.currentRound,
        predictionEnabled: updatedMatch.predictionEnabled,
        advanceType: "pitcher_change",
        skippedResult,
        gamePhase,
        message: skippedResult
          ? `투수 교체(결과 생략·환불) — ${gamePhase.displayLabel}`
          : `투수 교체 — ${gamePhase.displayLabel}`,
      });

      // 전면·보상 광고 (배너 없음) — 교체 안내 연출 후 재생 (수동·자동 공통 쿨다운)
      const pitcherRewardKey = `${id}:pitcher:${Date.now()}`;
      const adStarted = broadcastManager.tryScheduleAdBreak(id, {
        rewardKey: pitcherRewardKey,
        reason: "pitcher_change",
      });

      notifyManualAtBatAction(id, "pitcher");
      await syncAtBatPhaseAfterManual(id, "manual_pitcher_change");

      return res.json({
        success: true,
        message: skippedResult
          ? "투수 교체가 반영되었습니다. (미정산 예측은 환불)"
          : "투수 교체가 반영되었습니다.",
        currentRound: updatedMatch.currentRound,
        gamePhase,
        predictionAutoStopped,
        skippedResult,
        adStarted,
      });
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Pitcher change error:", error);
      const { status, message } = operatorControlErrorStatus(error);
      return res.status(status).json({
        error: status === 500 ? message || "투수 교체 처리에 실패했습니다." : message,
      });
    }
  });

  // 오늘 경기 팀 선수단 (운영자 타순/대타 선택)
  app.get("/api/manager/matches/:id/kbo-roster", async (req, res) => {
    try {
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      const side = req.query.side === "home" ? "home" : "away";
      const seasonRaw = Number.parseInt(String(req.query.season ?? ""), 10);
      const season = Number.isFinite(seasonRaw)
        ? seasonRaw
        : match.startTime
          ? new Date(match.startTime as string | Date).getFullYear()
          : new Date().getFullYear();
      const team = resolveMatchTeamShort(match, side);
      if (!team) {
        return res.json({ team: null, season, players: [] });
      }
      const players = await listKboPlayers({ team, season, activeOnly: true });
      return res.json({ team, season, players });
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Manager kbo roster error:", error);
      const message = error instanceof Error ? error.message : "선수단을 불러오지 못했습니다.";
      return res.status(400).json({ error: message });
    }
  });

  // 타순·시즌 스탯 수동 입력 (KBO API 라인업 미제공 대응)
  app.patch("/api/manager/matches/:id/lineup", async (req, res) => {
    try {
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      const batterSchema = z.object({
        battingOrder: z.number().int().min(1).max(9),
        name: z.string().trim().max(40).optional(),
        rosterPlayerId: z.string().trim().min(1).max(80).optional(),
        battingAverage: z.union([z.string(), z.number()]).nullable().optional(),
        hits: z.number().int().min(0).max(999).nullable().optional(),
        homeRuns: z.number().int().min(0).max(999).nullable().optional(),
        rbi: z.number().int().min(0).max(999).nullable().optional(),
        ops: z.union([z.string(), z.number()]).nullable().optional(),
        position: z.string().trim().max(20).nullable().optional(),
        note: z.string().trim().max(80).nullable().optional(),
      });

      const body = z
        .object({
          side: z.enum(["home", "away"]).optional(),
          home: z.array(batterSchema).max(9).optional(),
          away: z.array(batterSchema).max(9).optional(),
        })
        .parse(req.body ?? {});

      const saved = await saveManualMatchLineup(id, {
        side: body.side,
        home: body.home ?? [],
        away: body.away ?? [],
      });
      return res.json({
        success: true,
        message: "타순·시즌 기록을 저장했습니다. (수동 — API 덮어쓰기 없음)",
        matchLineup: saved.matchLineup,
        matchPlayerStats: saved.matchPlayerStats,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Manager lineup patch error:", error);
      const message = error instanceof Error ? error.message : "타순 저장에 실패했습니다.";
      return res.status(400).json({ error: message });
    }
  });

  // 대타 설정 — 현재 타석 이름·시즌 스탯 (예측 화면에 안내)
  app.post("/api/manager/matches/:id/pinch-hitter", async (req, res) => {
    try {
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }
      await assertMatchLiveForControls(id);

      const body = z
        .object({
          playerName: z.string().trim().max(40).optional(),
          rosterPlayerId: z.string().trim().min(1).max(80).optional(),
          battingAverage: z.union([z.string(), z.number()]).nullable().optional(),
          hits: z.number().int().min(0).max(999).nullable().optional(),
          homeRuns: z.number().int().min(0).max(999).nullable().optional(),
          rbi: z.number().int().min(0).max(999).nullable().optional(),
          ops: z.union([z.string(), z.number()]).nullable().optional(),
          season: z.number().int().min(2000).max(2100).optional(),
        })
        .parse(req.body ?? {});

      const pinchHitter = await setMatchPinchHitter(id, body);
      const gamePhase = buildGamePhasePayload(match as typeof match);

      broadcastManager.sendToMatch(id, "pinch_hitter_set", {
        matchId: id,
        pinchHitter,
        gamePhase,
        message: `대타 ${pinchHitter.playerName}이(가) 타석에 나옵니다.`,
      });
      // 광고 시작 없음 — 전면광고는 공수교대·투수교체만

      return res.json({
        success: true,
        message: "대타를 설정했습니다.",
        pinchHitter,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Manager pinch-hitter error:", error);
      const message = error instanceof Error ? error.message : "대타 설정에 실패했습니다.";
      return res.status(400).json({ error: message });
    }
  });

  app.delete("/api/manager/matches/:id/pinch-hitter", async (req, res) => {
    try {
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      await clearMatchPinchHitter(id);
      broadcastManager.sendToMatch(id, "pinch_hitter_cleared", {
        matchId: id,
        message: "대타가 해제되었습니다.",
      });

      return res.json({ success: true, message: "대타를 해제했습니다." });
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Manager pinch-hitter clear error:", error);
      const message = error instanceof Error ? error.message : "대타 해제에 실패했습니다.";
      return res.status(400).json({ error: message });
    }
  });

  // 스코어보드 수동 보정 (매니저) — TV 기준으로 점수 맞춤, API 덮어쓰기 잠금
  app.patch("/api/manager/matches/:id/scoreboard", async (req, res) => {
    try {
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      const body = z
        .object({
          homeScore: z.number().int().min(0).max(99).optional(),
          awayScore: z.number().int().min(0).max(99).optional(),
          homeHits: z.number().int().min(0).max(99).optional(),
          awayHits: z.number().int().min(0).max(99).optional(),
          homeErrors: z.number().int().min(0).max(99).optional(),
          awayErrors: z.number().int().min(0).max(99).optional(),
          homeWalks: z.number().int().min(0).max(99).optional(),
          awayWalks: z.number().int().min(0).max(99).optional(),
          inning: z.number().int().min(1).max(20).nullable().optional(),
          inningHalf: z.enum(["top", "bottom"]).nullable().optional(),
          lockManual: z.boolean().optional(),
          syncOperatorPhase: z.boolean().optional(),
        })
        .parse(req.body ?? {});

      const updated = await patchMatchLiveScoreboard(id, {
        ...body,
        lockManual: body.lockManual !== false,
        syncOperatorPhase: body.syncOperatorPhase === true,
      });

      return res.json({
        success: true,
        message: "스코어보드를 보정했습니다. (수동 모드 — API 점수 덮어쓰기 잠금)",
        controlMode: (updated as { controlMode?: string }).controlMode ?? "manual",
        scoreboard: (updated as { liveScoreboard?: unknown }).liveScoreboard ?? null,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Manager scoreboard patch error:", error);
      const message = error instanceof Error ? error.message : "스코어보드 보정에 실패했습니다.";
      return res.status(400).json({ error: message });
    }
  });

  // 공수교대 (매니저 전용)
  app.post("/api/manager/control/:id/round/switch-half", async (req, res) => {
    try {
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }
      await assertMatchLiveForControls(id);

      await assertRoundResultSentOrAllowAdvance(id, match.currentRound);
      assertSwitchHalfNotDuringAd(id);

      const body = z.object({ force: z.boolean().optional() }).parse(req.body ?? {});
      const { match: updatedMatch, pinchCleared } = await advanceInningHalf(id, {
        force: body.force === true,
      });
      const gamePhase = buildGamePhasePayload(updatedMatch as typeof match);

      emitPinchCleared(id, pinchCleared);

      broadcastManager.clearAdTimer(id);
      if (broadcastManager.isAdPlaying(id)) {
        broadcastManager.stopAdPlaying(id, "round_advance", "라운드 전환으로 광고가 중지되었습니다.");
      }

      broadcastRoundNextThenStats(id, {
        currentRound: updatedMatch.currentRound,
        predictionEnabled: updatedMatch.predictionEnabled,
        advanceType: "switch_half",
        gamePhase,
        message: `공수교대 — ${gamePhase.displayLabel}`,
      });

      // 전면·보상 광고 (배너 없음) — 공수교대 안내 연출 후 재생 (수동·자동 공통 쿨다운)
      const halfRewardKey = `${id}:switch-half:${Date.now()}`;
      const adStarted = broadcastManager.tryScheduleAdBreak(id, {
        rewardKey: halfRewardKey,
        reason: "switch_half",
      });

      notifyManualAtBatAction(id, "switch");
      await syncAtBatPhaseAfterManual(id, "manual_switch_half");

      return res.json({
        success: true,
        message: "공수교대가 반영되었습니다.",
        currentRound: updatedMatch.currentRound,
        gamePhase,
        adStarted,
        predictionAutoStopped: false,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "공수교대 요청이 올바르지 않습니다." });
      }
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      const { status, message } = operatorControlErrorStatus(error);
      if (status === 500) console.error("Switch half error:", error);
      return res.status(status).json({
        error: status === 500 ? message || "공수교대 처리에 실패했습니다." : message,
      });
    }
  });

  // 광고 시작은 공수교대·투수교체만 — 별도 시작 API 없음
  app.post("/api/manager/matches/:id/ad/start", async (_req, res) => {
    return res.status(400).json({
      error: "광고는 공수교대·투수교체에서만 시작됩니다.",
    });
  });

  // 광고 중지 (매니저 전용)
  app.post("/api/manager/matches/:id/ad/stop", async (req, res) => {
    try {
      const decoded = await requirePpamongOperatorAuth(req, res);
      if (!decoded) return;

      const { id } = req.params;
      
      // 경기가 매니저에게 할당되었는지 확인
      const match = await adminMatchStorage.getMatchByIdForManager(id, decoded.adminId);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없거나 권한이 없습니다." });
      }

      broadcastManager.stopAdPlaying(id, "operator_stop", "광고가 중지되었습니다.");

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
