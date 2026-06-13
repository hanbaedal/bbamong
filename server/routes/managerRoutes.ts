import type { Express, Request } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AdminStorage } from "../storage/adminStorage";
import { adminMatchStorage } from "../storage/adminMatchStorage";
import { insertAdminUserSchema } from "@shared/schema";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyAccessToken } from "../utils/jwt";
import { broadcastManager } from "../liveMatch/broadcastManager";
import { startRound, stopRound, updateRoundPredictionResult, nextRound, getMatchOverallStatistics } from "../liveMatch/predictionStorage";
import { hasActiveSession, createSession, deleteSession, hasLogoutPermission, revokeLogoutPermission } from "../sessionManager";

const adminStorage = new AdminStorage();

// Authorization 헤더 또는 쿠키에서 매니저 액세스 토큰 추출
function getManagerAccessToken(req: Request): string | null {
  // Authorization 헤더 우선 확인 (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  // 쿠키에서 확인 (웹 브라우저 호환)
  return req.cookies?.managerAccessToken || null;
}

export async function managerRoutes(app: Express): Promise<void> {
  // 매니저 회원가입
  app.post("/api/manager/signup", async (req, res) => {
    try {
      const requestData = {
        ...req.body,
        department: req.body.department || null,
        position: req.body.position || null,
      };

      const validatedData = insertAdminUserSchema.parse(requestData);

      // 이메일 중복 확인 (승인된 계정만 체크)
      const existingAdmin = await adminStorage.getAdminUserByEmail(validatedData.email, true);
      if (existingAdmin) {
        if (existingAdmin.status === "비활성화") {
          const hashedPassword = await bcrypt.hash(validatedData.password, 10);
          const reactivated = await adminStorage.updateAdminUser(existingAdmin.id, {
            ...validatedData,
            password: hashedPassword,
            status: "활성화",
            approvalStatus: "대기중",
          });
          const { password, ...managerWithoutPassword } = reactivated!;
          return res.status(201).json({
            success: true,
            message: "계정이 재활성화되었습니다. 관리자 승인 후 로그인 가능합니다.",
            manager: managerWithoutPassword,
          });
        }
        return res.status(400).json({ error: "이미 사용 중인 이메일입니다." });
      }

      // 전화번호 중복 확인 (승인된 계정만 체크)
      if (validatedData.phone) {
        const existingByPhone = await adminStorage.getAdminUserByPhone(validatedData.phone, true);
        if (existingByPhone) {
          return res.status(400).json({ error: "이미 사용 중인 전화번호입니다." });
        }
      }

      // 아이디 중복 확인 (승인된 계정만 체크)
      if (validatedData.username) {
        const existingByUsername = await adminStorage.getAdminUserByUsername(validatedData.username, true);
        if (existingByUsername) {
          return res.status(400).json({ error: "이미 사용 중인 아이디입니다." });
        }
      }

      // 비밀번호 해싱
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      // 매니저는 수동 승인으로 생성 (userType 서버에서 강제)
      const newManager = await adminStorage.createAdminUser({
        ...validatedData,
        password: hashedPassword,
        userType: "매니저",
        approvalStatus: "대기중",
      });

      // 비밀번호 제외하고 반환
      const { password, ...managerWithoutPassword } = newManager;

      return res.status(201).json({
        success: true,
        message: "회원가입이 완료되었습니다.",
        manager: managerWithoutPassword,
      });
    } catch (error: any) {
      console.error("Manager signup error:", error);
      
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          error: "입력 데이터가 올바르지 않습니다.",
          details: error.errors,
        });
      }

      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 매니저 로그인
  app.post("/api/manager/login", async (req, res) => {
    try {
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

      const hasSession = await hasActiveSession("manager", manager.id);
      if (hasSession) {
        console.log(`[Manager Login] 기존 세션 존재 - force-replace로 기존 세션 삭제: ${manager.id}`);
        await deleteSession("manager", manager.id);
        const { wsManager } = await import("../liveMatch/wsManager");
        wsManager.forceDisconnectBySubjectId("manager", manager.id);
      }

      // JWT 토큰 생성
      const tokenPayload = {
        adminId: manager.id,
        email: manager.email,
        userType: manager.userType,
        approvalStatus: manager.approvalStatus,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Redis-DB 동기화: Redis 세션을 먼저 생성하여 원자성 보장
      try {
        // 1. Redis 세션 생성 (실패 시 즉시 에러)
        await createSession("manager", manager.id, {
          email: manager.email,
          userType: manager.userType,
        });

        // 2. Redis 성공 후 DB lastLogin 업데이트
        await adminStorage.updateAdminUser(manager.id, {
          lastLogin: new Date(),
        });
      } catch (error) {
        // Redis 또는 DB 실패 시 세션 정리
        try {
          await deleteSession("manager", manager.id);
        } catch (cleanupError) {
          console.error("Failed to cleanup session after login failure:", cleanupError);
        }
        throw error;
      }

      // 쿠키에 토큰 저장 (매니저 전용 쿠키, 모바일 앱을 위해 sameSite: "none" 사용)
      res.cookie("managerAccessToken", accessToken, {
        httpOnly: true,
        secure: true, // sameSite: "none"은 secure: true 필수
        sameSite: "none",
        path: "/", // WebSocket 연결 시 쿠키 전송을 위해 루트 경로로 설정
        maxAge: 15 * 60 * 1000, // 15분
      });

      res.cookie("managerRefreshToken", refreshToken, {
        httpOnly: true,
        secure: true, // sameSite: "none"은 secure: true 필수
        sameSite: "none",
        path: "/", // WebSocket 연결 시 쿠키 전송을 위해 루트 경로로 설정
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
      });

      return res.json({
        success: true,
        message: "로그인 성공",
        accessToken,
        refreshToken,
      });
    } catch (error) {
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

      const sessionExists = await hasActiveSession("manager", decoded.adminId);
      if (!sessionExists) {
        console.log("[매니저 리프레시] Redis 세션 재생성:", decoded.adminId);
      }

      await createSession("manager", decoded.adminId, {
        email: decoded.email,
        userType: decoded.userType,
      });

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

      return res.json(match);
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

      // 결과 전송 후 자동으로 다음 라운드로 이동
      let nextRoundNumber = match.currentRound;
      try {
        const { match: updatedMatch } = await nextRound(id);
        nextRoundNumber = updatedMatch.currentRound;

        // SSE로 라운드 증가 이벤트 전송
        broadcastManager.sendToMatch(id, "round_next", {
          matchId: id,
          currentRound: updatedMatch.currentRound,
          predictionEnabled: updatedMatch.predictionEnabled,
          message: `라운드 ${updatedMatch.currentRound}으로 이동했습니다.`
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

  // 다음 라운드로 이동 (매니저 전용)
  app.post("/api/manager/control/:id/round/next", async (req, res) => {
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

      // 다음 라운드로 이동 (force=true: 예측 중이어도 자동 중지 후 진행, 제약 없음)
      const { match: updatedMatch, predictionAutoStopped } = await nextRound(id, true);

      const overallStats = await getMatchOverallStatistics(id);

      // 예측이 자동 중지된 경우 먼저 prediction_stopped 이벤트 전송 (중지된 라운드 번호: 증가 전)
      if (predictionAutoStopped) {
        broadcastManager.sendToMatch(id, "prediction_stopped", {
          matchId: id,
          currentRound: updatedMatch.currentRound - 1,
          stoppedRound: updatedMatch.currentRound - 1,
          message: "공수교대/투수교체로 인해 예측이 자동 중지되었습니다."
        });
      }

      // 라운드 전환 시 진행 중인 광고 자동 종료
      broadcastManager.clearAdTimer(id);
      if (broadcastManager.isAdPlaying(id)) {
        broadcastManager.setAdPlaying(id, false);
        broadcastManager.sendToMatch(id, "ad_stopped", {
          matchId: id,
          message: "라운드 전환으로 광고가 중지되었습니다."
        });
      }

      // SSE로 라운드 증가 이벤트 전송
      broadcastManager.sendToMatch(id, "round_next", {
        matchId: id,
        currentRound: updatedMatch.currentRound,
        predictionEnabled: updatedMatch.predictionEnabled,
        overallStats,
        skippedResult: true,
        message: `라운드 ${updatedMatch.currentRound}으로 이동했습니다.`
      });

      return res.json({ 
        success: true, 
        message: "다음 라운드로 이동했습니다.",
        currentRound: updatedMatch.currentRound,
        predictionEnabled: updatedMatch.predictionEnabled,
        overallStats,
        adStarted: true,
        predictionAutoStopped,
      });
    } catch (error: any) {
      if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: "인증이 만료되었습니다." });
      }
      console.error("Next round error:", error);
      return res.status(500).json({ error: error.message || "다음 라운드 이동에 실패했습니다." });
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
