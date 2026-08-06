import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { verifyAccessToken, verifyRefreshToken, generateAccessToken, generateRefreshToken, type TokenPayload } from "../utils/jwt";
import { AdminUserModel } from "../UserStorage/db";
import {
  clearAdminAuthCookies,
  setAdminAccessCookie,
  setAdminRefreshCookie,
} from "../utils/adminCookies";
import { canAccessPpamongAdminWeb } from "../utils/staffUsername";

export interface AuthenticatedAdminRequest extends Request {
  admin?: TokenPayload;
}

type AdminAuthRecord = {
  id: string;
  email: string;
  userType: string;
  approvalStatus: string;
  status?: string;
  username: string;
};

async function loadPpamongAdminForAuth(adminId: string): Promise<AdminAuthRecord | null> {
  const admin = await AdminUserModel.findOne({ id: adminId })
    .select("id email userType approvalStatus status username")
    .lean();

  if (!admin || admin.approvalStatus !== "승인") return null;
  if (admin.status === "비활성화") return null;
  if (!canAccessPpamongAdminWeb(admin.username, admin.userType)) return null;

  return admin as AdminAuthRecord;
}

function toTokenPayload(admin: AdminAuthRecord): TokenPayload {
  return {
    adminId: admin.id,
    email: admin.email,
    userType: admin.userType,
    approvalStatus: admin.approvalStatus,
  };
}

async function tryRefreshAdminToken(req: Request, res: Response): Promise<TokenPayload | null> {
  const refreshToken = req.cookies?.adminRefreshToken;
  if (!refreshToken) return null;

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const admin = await loadPpamongAdminForAuth(decoded.adminId);
    if (!admin) {
      clearAdminAuthCookies(res);
      return null;
    }

    const tokenPayload = toTokenPayload(admin);
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    setAdminAccessCookie(res, newAccessToken);
    setAdminRefreshCookie(res, newRefreshToken);

    return tokenPayload;
  } catch {
    clearAdminAuthCookies(res);
    return null;
  }
}

export async function adminAuthMiddleware(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const accessToken = req.cookies?.adminAccessToken;

  if (!accessToken) {
    const refreshed = await tryRefreshAdminToken(req, res);
    if (refreshed) {
      req.admin = refreshed;
      next();
      return;
    }
    res.status(401).json({ message: "인증 토큰이 없습니다." });
    return;
  }

  try {
    const decoded = verifyAccessToken(accessToken);
    if (decoded.approvalStatus !== "승인") {
      res.status(403).json({ message: "승인되지 않은 계정입니다." });
      return;
    }

    const admin = await loadPpamongAdminForAuth(decoded.adminId);
    if (!admin) {
      clearAdminAuthCookies(res);
      res.status(403).json({ message: "빠몽에서 등록된 관리자 계정만 접근할 수 있습니다." });
      return;
    }

    req.admin = toTokenPayload(admin);
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      const refreshed = await tryRefreshAdminToken(req, res);
      if (refreshed) {
        req.admin = refreshed;
        next();
        return;
      }
    }
    res.status(401).json({ message: "유효하지 않거나 만료된 토큰입니다." });
  }
}

export async function superAdminAuthMiddleware(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const accessToken = req.cookies?.adminAccessToken;

  if (!accessToken) {
    const refreshed = await tryRefreshAdminToken(req, res);
    if (refreshed) {
      if (refreshed.userType !== "슈퍼어드민") {
        res.status(403).json({ message: "슈퍼어드민 권한이 필요합니다." });
        return;
      }
      req.admin = refreshed;
      next();
      return;
    }
    res.status(401).json({ message: "인증 토큰이 없습니다." });
    return;
  }

  try {
    const decoded = verifyAccessToken(accessToken);
    if (decoded.approvalStatus !== "승인") {
      res.status(403).json({ message: "승인되지 않은 계정입니다." });
      return;
    }
    if (decoded.userType !== "슈퍼어드민") {
      res.status(403).json({ message: "슈퍼어드민 권한이 필요합니다." });
      return;
    }

    const admin = await loadPpamongAdminForAuth(decoded.adminId);
    if (!admin) {
      clearAdminAuthCookies(res);
      res.status(403).json({ message: "빠몽에서 등록된 관리자 계정만 접근할 수 있습니다." });
      return;
    }

    req.admin = toTokenPayload(admin);
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      const refreshed = await tryRefreshAdminToken(req, res);
      if (refreshed) {
        if (refreshed.userType !== "슈퍼어드민") {
          res.status(403).json({ message: "슈퍼어드민 권한이 필요합니다." });
          return;
        }
        req.admin = refreshed;
        next();
        return;
      }
    }
    res.status(401).json({ message: "유효하지 않거나 만료된 토큰입니다." });
  }
}
