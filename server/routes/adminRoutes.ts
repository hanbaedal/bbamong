import type { Express } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { AdminStorage } from "../storage/adminStorage";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyAccessToken } from "../utils/jwt";
import { adminAuthMiddleware, superAdminAuthMiddleware } from "../middleware/adminAuth";
import { broadcastManager } from "../liveMatch/broadcastManager";
import { adminMatchStorage } from "../storage/adminMatchStorage";
import { hasActiveSession, createSession, deleteSession } from "../sessionManager";

const adminStorage = new AdminStorage();

export async function adminRoutes(app: Express): Promise<void> {
  // 관리자 전화번호 중복 확인
  app.post("/api/admin/check-phone", async (req, res) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "전화번호를 입력해주세요." });
      }

      const cleanPhone = phone.replace(/-/g, "");
      const existingAdmin = await adminStorage.getAdminUserByPhone(cleanPhone, true);

      if (existingAdmin) {
        return res.json({ exists: true, message: "이미 등록된 전화번호입니다." });
      }

      return res.json({ exists: false, message: "사용 가능한 전화번호입니다." });
    } catch (error) {
      console.error("Admin phone check error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 관리자 공개 회원가입 비활성화 — 슈퍼바이저만 관리자 등록 가능
  app.post("/api/admin/signup", async (_req, res) => {
    return res.status(403).json({
      error: "관리자 계정은 슈퍼바이저가 등록합니다. 슈퍼바이저에게 문의하세요.",
    });
  });

  // 관리자 로그인
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "이메일 또는 아이디와 비밀번호를 입력해주세요." });
      }

      let admin = await adminStorage.getAdminUserByEmail(email);
      if (!admin) {
        admin = await adminStorage.getAdminUserByUsername(email);
      }

      if (!admin) {
        return res.status(401).json({ error: "이메일 또는 비밀번호가 일치하지 않습니다." });
      }

      const isBcryptHash = admin.password.startsWith("$2b$") || admin.password.startsWith("$2a$");
      let passwordMatch = false;

      if (isBcryptHash) {
        passwordMatch = await bcrypt.compare(password, admin.password);
      } else {
        passwordMatch = password === admin.password;
        if (passwordMatch) {
          const hashedPassword = await bcrypt.hash(password, 10);
          await adminStorage.updateAdminUser(admin.id, { password: hashedPassword });
          console.log(`[Admin Login] 평문 비밀번호를 bcrypt로 자동 변환: ${admin.email}`);
        }
      }

      if (!passwordMatch) {
        return res.status(401).json({ error: "이메일 또는 비밀번호가 일치하지 않습니다." });
      }

      if (admin.userType !== "슈퍼어드민" && admin.userType !== "일반어드민") {
        return res.status(403).json({ error: "관리자 계정이 아닙니다." });
      }

      // 승인 상태 확인
      if (admin.approvalStatus === "대기중") {
        return res.status(403).json({ error: "관리자 승인 대기 중입니다." });
      }

      if (admin.approvalStatus === "거부") {
        return res.status(403).json({ error: "계정이 거부되었습니다. 관리자에게 문의해주세요." });
      }

      // 기존 세션이 있으면 새 로그인으로 교체 (모바일·PC 전환 지원)
      const hasSession = await hasActiveSession("admin", admin.id);
      if (hasSession) {
        console.log(`[Admin Login] 기존 세션 강제 교체: ${admin.id}`);
        await deleteSession("admin", admin.id);
      }

      // JWT 토큰 생성
      const tokenPayload = {
        adminId: admin.id,
        email: admin.email,
        userType: admin.userType,
        approvalStatus: admin.approvalStatus,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Redis-DB 동기화: Redis 세션을 먼저 생성하여 원자성 보장
      try {
        // 1. Redis 세션 생성 (실패 시 즉시 에러)
        await createSession("admin", admin.id, {
          email: admin.email,
          userType: admin.userType,
        });

        // 2. Redis 성공 후 DB lastLogin 업데이트
        await adminStorage.updateAdminUser(admin.id, {
          lastLogin: new Date(),
        });
      } catch (error) {
        // Redis 또는 DB 실패 시 세션 정리
        try {
          await deleteSession("admin", admin.id);
        } catch (cleanupError) {
          console.error("Failed to cleanup session after login failure:", cleanupError);
        }
        throw error;
      }

      // 쿠키에 토큰 저장 (모바일 앱을 위해 sameSite: "none" 사용)
      res.cookie("adminAccessToken", accessToken, {
        httpOnly: true,
        secure: true, // sameSite: "none"은 secure: true 필수
        sameSite: "none",
        path: "/", // WebSocket 연결 시 쿠키 전송을 위해 루트 경로로 설정
        maxAge: 15 * 60 * 1000, // 15분
      });

      res.cookie("adminRefreshToken", refreshToken, {
        httpOnly: true,
        secure: true, // sameSite: "none"은 secure: true 필수
        sameSite: "none",
        path: "/", // WebSocket 연결 시 쿠키 전송을 위해 루트 경로로 설정
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      });

      const { password: _pw, ...adminWithoutPassword } = admin;

      return res.json({
        success: true,
        message: "로그인 성공",
        userType: admin.userType,
        admin: adminWithoutPassword,
      });
    } catch (error) {
      console.error("Admin login error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // Refresh token으로 access token 재발급 (RTR: Refresh Token Rotation)
  app.post("/api/admin/refresh", async (req, res) => {
    try {
      const refreshToken = req.cookies?.adminRefreshToken;

      if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token이 없습니다." });
      }

      const decoded = verifyRefreshToken(refreshToken);

      const admin = await adminStorage.getAdminUserByEmail(decoded.email);
      if (!admin || admin.approvalStatus !== "승인") {
        return res.status(401).json({ error: "유효하지 않은 사용자입니다." });
      }

      const tokenPayload = {
        adminId: admin.id,
        email: admin.email,
        userType: admin.userType,
        approvalStatus: admin.approvalStatus,
      };

      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      res.cookie("adminAccessToken", newAccessToken, {
        httpOnly: true,
        secure: true, // sameSite: "none"은 secure: true 필수
        sameSite: "none",
        path: "/", // WebSocket 연결 시 쿠키 전송을 위해 루트 경로로 설정
        maxAge: 15 * 60 * 1000, // 15분
      });

      res.cookie("adminRefreshToken", newRefreshToken, {
        httpOnly: true,
        secure: true, // sameSite: "none"은 secure: true 필수
        sameSite: "none",
        path: "/", // WebSocket 연결 시 쿠키 전송을 위해 루트 경로로 설정
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      });

      return res.json({
        success: true,
        message: "Access token과 refresh token이 재발급되었습니다.",
      });
    } catch (error) {
      console.error("Admin refresh token error:", error);
      return res.status(401).json({ error: "유효하지 않거나 만료된 refresh token입니다." });
    }
  });

  // Admin 로그아웃
  app.post("/api/admin/logout", async (req, res) => {
    try {
      let adminId: string | undefined;
      
      const accessToken = req.cookies?.adminAccessToken;
      const refreshToken = req.cookies?.adminRefreshToken;
      
      if (accessToken) {
        try {
          const decoded = verifyAccessToken(accessToken);
          adminId = decoded?.adminId;
        } catch (error) {
          try {
            const decoded = jwt.decode(accessToken) as any;
            adminId = decoded?.adminId;
          } catch (e) {
            console.log("Failed to decode access token");
          }
        }
      }
      
      if (!adminId && refreshToken) {
        try {
          const decoded = verifyRefreshToken(refreshToken);
          adminId = decoded?.adminId;
        } catch (error) {
          try {
            const decoded = jwt.decode(refreshToken) as any;
            adminId = decoded?.adminId;
          } catch (e) {
            console.log("Failed to decode refresh token");
          }
        }
      }
      
      if (adminId) {
        // Redis-DB 동기화: 세션 삭제를 먼저 수행 (보안 우선)
        // 1. Redis 세션 삭제 (실패 시 에러 throw)
        await deleteSession("admin", adminId);
        
        // 2. DB lastLogout 업데이트 (실패해도 세션은 이미 삭제됨)
        try {
          await adminStorage.updateAdminUser(adminId, {
            lastLogout: new Date(),
          });
        } catch (dbError) {
          console.error("Failed to update lastLogout:", dbError);
          // 세션은 이미 삭제되었으므로 계속 진행
        }
      }

      res.clearCookie("adminAccessToken");
      res.clearCookie("adminRefreshToken");
      return res.json({
        success: true,
        message: "로그아웃되었습니다.",
      });
    } catch (error) {
      console.error("Admin logout error:", error);
      res.clearCookie("adminAccessToken");
      res.clearCookie("adminRefreshToken");
      return res.json({
        success: true,
        message: "로그아웃되었습니다.",
      });
    }
  });

  // 현재 로그인한 관리자 정보 조회
  app.get("/api/admin/me", adminAuthMiddleware, async (req: any, res) => {
    try {
      const adminId = req.admin?.adminId;
      
      if (!adminId) {
        return res.status(401).json({ error: "인증 정보가 없습니다." });
      }

      const admin = await adminStorage.getAdminUserById(adminId);

      if (!admin) {
        return res.status(404).json({ error: "관리자를 찾을 수 없습니다." });
      }

      // 비밀번호 제외하고 반환
      const { password, ...adminWithoutPassword } = admin;

      return res.json(adminWithoutPassword);
    } catch (error) {
      console.error("Get current admin error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 모든 관리자 조회 (슈퍼어드민만 가능)
  app.get("/api/admin/users", superAdminAuthMiddleware, async (req, res) => {
    try {
      const admins = await adminStorage.getAllAdminUsers();

      // 비밀번호 제외하고 반환
      const adminsWithoutPassword = admins.map(({ password, ...admin }) => admin);

      return res.json(adminsWithoutPassword);
    } catch (error) {
      console.error("Get admin users error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 특정 관리자 조회 (본인 또는 슈퍼어드민만 가능)
  app.get("/api/admin/users/:id", adminAuthMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentAdmin = req.admin;

      // 본인 또는 슈퍼어드민만 조회 가능
      if (currentAdmin.adminId !== id && currentAdmin.userType !== "슈퍼어드민") {
        return res.status(403).json({ error: "본인 정보만 조회할 수 있습니다." });
      }

      const admin = await adminStorage.getAdminUserById(id);

      if (!admin) {
        return res.status(404).json({ error: "관리자를 찾을 수 없습니다." });
      }

      // 비밀번호 제외하고 반환
      const { password, ...adminWithoutPassword } = admin;

      return res.json(adminWithoutPassword);
    } catch (error) {
      console.error("Get admin user error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 관리자 승인 상태 변경 (슈퍼어드민만 가능)
  app.patch("/api/admin/users/:id/approval", superAdminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { approvalStatus } = req.body;

      if (!["대기중", "승인", "거부"].includes(approvalStatus)) {
        return res.status(400).json({ error: "올바르지 않은 승인 상태입니다." });
      }

      const updatedAdmin = await adminStorage.updateApprovalStatus(id, approvalStatus);

      if (!updatedAdmin) {
        return res.status(404).json({ error: "관리자를 찾을 수 없습니다." });
      }

      // 비밀번호 제외하고 반환
      const { password, ...adminWithoutPassword } = updatedAdmin;

      return res.json({
        success: true,
        message: "승인 상태가 변경되었습니다.",
        admin: adminWithoutPassword,
      });
    } catch (error) {
      console.error("Update approval status error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 관리자 정보 수정 (본인 또는 슈퍼어드민만 가능)
  app.patch("/api/admin/users/:id", adminAuthMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const currentAdmin = req.admin;

      // 본인 또는 슈퍼어드민만 수정 가능
      if (currentAdmin.adminId !== id && currentAdmin.userType !== "슈퍼어드민") {
        return res.status(403).json({ error: "본인 정보만 수정할 수 있습니다." });
      }

      // 비밀번호, 이메일, 승인상태, 유저타입은 이 API로 변경 불가
      delete updateData.password;
      delete updateData.email;
      delete updateData.approvalStatus;
      delete updateData.userType;

      const updatedAdmin = await adminStorage.updateAdminUser(id, updateData);

      if (!updatedAdmin) {
        return res.status(404).json({ error: "관리자를 찾을 수 없습니다." });
      }

      // 비밀번호 제외하고 반환
      const { password, ...adminWithoutPassword } = updatedAdmin;

      return res.json({
        success: true,
        message: "관리자 정보가 수정되었습니다.",
        admin: adminWithoutPassword,
      });
    } catch (error) {
      console.error("Update admin user error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 관리자 삭제 (슈퍼어드민만 가능)
  app.delete("/api/admin/users/:id", superAdminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;

      const targetUser = await adminStorage.getAdminUserById(id);
      if (!targetUser) {
        return res.status(404).json({ error: "관리자를 찾을 수 없습니다." });
      }

      if (targetUser.userType === "슈퍼어드민") {
        return res.status(403).json({ error: "슈퍼바이저 계정은 삭제할 수 없습니다." });
      }

      const sessionType: "manager" | "admin" = targetUser.userType === "매니저" ? "manager" : "admin";

      try {
        await deleteSession(sessionType, id);
        console.log(`[AdminDelete] Session deleted for ${sessionType}:${id}`);
      } catch (sessionError) {
        console.error(`[AdminDelete] Session deletion failed for ${sessionType}:${id}:`, sessionError);
      }

      const deleted = await adminStorage.deleteAdminUser(id);

      if (!deleted) {
        return res.status(404).json({ error: "관리자를 찾을 수 없습니다." });
      }

      console.log(`[AdminDelete] User ${targetUser.username} (${sessionType}) deleted successfully`);

      return res.json({
        success: true,
        message: "관리자가 삭제되었습니다.",
      });
    } catch (error) {
      console.error("Delete admin user error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 승인 상태별 관리자 목록 조회 (슈퍼어드민만 가능, 페이지네이션 + 검색)
  app.get("/api/admin/staff", superAdminAuthMiddleware, async (req, res) => {
    try {
      const status = (req.query.status as string) || "승인";
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;
      const search = (req.query.search as string) || "";
      const filterType = (req.query.filterType as string) || "전체";

      if (!["대기중", "승인", "거부"].includes(status)) {
        return res.status(400).json({ error: "올바르지 않은 상태 값입니다." });
      }

      if (!["전체", "부서", "직책"].includes(filterType)) {
        return res.status(400).json({ error: "올바르지 않은 필터 타입입니다." });
      }

      let admins, total, pendingCount, approvedCount;

      // 검색어가 있으면 검색 함수 사용
      if (search.trim()) {
        const result = await adminStorage.searchAdminUsersByStatus(
          status as "대기중" | "승인" | "거부",
          search.trim(),
          filterType as "전체" | "부서" | "직책",
          page,
          limit
        );
        admins = result.data;
        total = result.total;
        pendingCount = result.pendingCount;
        approvedCount = result.approvedCount;
      } else {
        // 검색어가 없으면 기존 함수 사용
        const result = await adminStorage.getAdminUsersByStatus(
          status as "대기중" | "승인" | "거부",
          page,
          limit
        );
        admins = result.data;
        total = result.total;
        pendingCount = result.pendingCount;
        approvedCount = result.approvedCount;
      }

      // 비밀번호 제외하고 반환
      const adminsWithoutPassword = admins.map(({ password, ...admin }) => admin);

      return res.json({
        admins: adminsWithoutPassword,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        pendingCount,
        approvedCount,
      });
    } catch (error) {
      console.error("Get staff list error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  const createStaffSchema = z.object({
    username: z.string().min(2, "아이디는 2자 이상이어야 합니다."),
    email: z.string().email("올바른 이메일 형식이 아닙니다."),
    name: z.string().min(1, "이름을 입력해주세요."),
    password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
    phone: z.string().min(10, "전화번호를 입력해주세요."),
    department: z.string().optional().nullable(),
    position: z.string().optional().nullable(),
  });

  const updateStaffSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(10).optional(),
    department: z.string().optional().nullable(),
    position: z.string().optional().nullable(),
    password: z.string().min(6).optional(),
    status: z.enum(["활성화", "비활성화"]).optional(),
  });

  // 슈퍼바이저 — 관리자 등록 (즉시 승인)
  app.post("/api/admin/staff", superAdminAuthMiddleware, async (req, res) => {
    try {
      const data = createStaffSchema.parse(req.body);

      const [byEmail, byUsername, byPhone] = await Promise.all([
        adminStorage.getAdminUserByEmail(data.email),
        adminStorage.getAdminUserByUsername(data.username),
        adminStorage.getAdminUserByPhone(data.phone.replace(/-/g, "")),
      ]);

      if (byEmail) {
        return res.status(400).json({ error: "이미 사용 중인 이메일입니다." });
      }
      if (byUsername) {
        return res.status(400).json({ error: "이미 사용 중인 아이디입니다." });
      }
      if (byPhone) {
        return res.status(400).json({ error: "이미 사용 중인 전화번호입니다." });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const newAdmin = await adminStorage.createAdminUser({
        username: data.username.trim(),
        email: data.email.trim(),
        name: data.name.trim(),
        password: hashedPassword,
        phone: data.phone.replace(/-/g, ""),
        department: data.department?.trim() || null,
        position: data.position?.trim() || null,
        userType: "일반어드민",
        approvalStatus: "승인",
        status: "활성화",
      });

      const { password: _pw, ...adminWithoutPassword } = newAdmin;
      return res.status(201).json({
        success: true,
        message: "관리자가 등록되었습니다.",
        admin: adminWithoutPassword,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: error.errors[0]?.message || "입력값이 올바르지 않습니다." });
      }
      console.error("Create staff error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 슈퍼바이저 — 관리자 수정
  app.patch("/api/admin/staff/:id", superAdminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const data = updateStaffSchema.parse(req.body);

      const target = await adminStorage.getAdminUserById(id);
      if (!target) {
        return res.status(404).json({ error: "관리자를 찾을 수 없습니다." });
      }
      if (target.userType === "슈퍼어드민" && target.username === "ppamong") {
        return res.status(403).json({ error: "슈퍼바이저 기본 계정은 이 화면에서 수정할 수 없습니다." });
      }
      if (target.userType === "매니저") {
        return res.status(400).json({ error: "매니저 계정은 운영자 관리 메뉴에서 수정하세요." });
      }

      const updatePayload: Record<string, unknown> = {};
      if (data.name !== undefined) updatePayload.name = data.name.trim();
      if (data.department !== undefined) updatePayload.department = data.department?.trim() || null;
      if (data.position !== undefined) updatePayload.position = data.position?.trim() || null;
      if (data.status !== undefined) updatePayload.status = data.status;
      if (data.phone !== undefined) {
        const cleanPhone = data.phone.replace(/-/g, "");
        const phoneTaken = await adminStorage.getAdminUserByPhone(cleanPhone);
        if (phoneTaken && phoneTaken.id !== id) {
          return res.status(400).json({ error: "이미 사용 중인 전화번호입니다." });
        }
        updatePayload.phone = cleanPhone;
      }
      if (data.email !== undefined) {
        const emailTaken = await adminStorage.getAdminUserByEmail(data.email.trim());
        if (emailTaken && emailTaken.id !== id) {
          return res.status(400).json({ error: "이미 사용 중인 이메일입니다." });
        }
        updatePayload.email = data.email.trim();
      }
      if (data.password) {
        updatePayload.password = await bcrypt.hash(data.password, 10);
      }

      const updated = await adminStorage.updateAdminUser(id, updatePayload);
      if (!updated) {
        return res.status(404).json({ error: "관리자를 찾을 수 없습니다." });
      }

      const { password: _pw, ...adminWithoutPassword } = updated;
      return res.json({
        success: true,
        message: "관리자 정보가 수정되었습니다.",
        admin: adminWithoutPassword,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: error.errors[0]?.message || "입력값이 올바르지 않습니다." });
      }
      console.error("Update staff error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.patch("/api/admin/users/:id/approve", superAdminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;

      const updatedAdmin = await adminStorage.updateApprovalStatus(id, "승인");

      if (!updatedAdmin) {
        return res.status(404).json({ error: "관리자를 찾을 수 없습니다." });
      }

      // 비밀번호 제외하고 반환
      const { password, ...adminWithoutPassword } = updatedAdmin;

      return res.json({
        success: true,
        message: "관리자 승인 처리 완료",
        admin: adminWithoutPassword,
      });
    } catch (error) {
      console.error("Admin approve error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 광고 시작 (관리자 전용)
  app.post("/api/admin/matches/:id/ad/start", async (req, res) => {
    try {
      const accessToken = req.cookies?.adminAccessToken;

      if (!accessToken) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      const decoded = verifyAccessToken(accessToken);

      if (!decoded) {
        return res.status(403).json({ error: "관리자 권한이 필요합니다." });
      }

      const { id } = req.params;
      
      // 경기 존재 여부 확인
      const match = await adminMatchStorage.getMatchById(id);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없습니다." });
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
      console.error("Start ad error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 광고 상태 조회 (인증 필요)
  app.get("/api/matches/:id/ad/status", async (req, res) => {
    try {
      const { id } = req.params;
      
      // 경기 존재 여부 확인
      const match = await adminMatchStorage.getMatchById(id);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없습니다." });
      }

      const isAdPlaying = broadcastManager.isAdPlaying(id);

      return res.json({ 
        success: true, 
        matchId: id,
        isAdPlaying
      });
    } catch (error) {
      console.error("Get ad status error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 광고 중지 (관리자 전용)
  app.post("/api/admin/matches/:id/ad/stop", async (req, res) => {
    try {
      const accessToken = req.cookies?.adminAccessToken;

      if (!accessToken) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      const decoded = verifyAccessToken(accessToken);

      if (!decoded) {
        return res.status(403).json({ error: "관리자 권한이 필요합니다." });
      }

      const { id } = req.params;
      
      // 경기 존재 여부 확인
      const match = await adminMatchStorage.getMatchById(id);
      if (!match) {
        return res.status(404).json({ error: "경기를 찾을 수 없습니다." });
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
      console.error("Stop ad error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // WebSocket 연결용 토큰 반환 (관리자 전용)
  app.get("/api/admin/ws-token", adminAuthMiddleware, async (req: any, res) => {
    try {
      const accessToken = req.cookies?.adminAccessToken;

      if (!accessToken) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      // 토큰 유효성은 이미 adminAuthMiddleware에서 검증됨
      return res.json({ 
        success: true, 
        token: accessToken 
      });
    } catch (error) {
      console.error("Get WS token error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

}
