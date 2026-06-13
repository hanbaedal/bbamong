import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { verifyAccessToken, verifyRefreshToken, generateAccessToken, generateRefreshToken, type TokenPayload } from "../utils/jwt";
import { db } from "../UserStorage/db";
import { adminUsers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createSession, refreshSession, hasActiveSession } from "../sessionManager";

export interface AuthenticatedManagerRequest extends Request {
  manager?: TokenPayload;
}

async function tryRefreshManagerToken(req: Request, res: Response): Promise<TokenPayload | null> {
  const refreshToken = req.cookies?.managerRefreshToken;
  if (!refreshToken) return null;

  try {
    const decoded = verifyRefreshToken(refreshToken);

    const newAccessToken = generateAccessToken({
      adminId: decoded.adminId,
      email: decoded.email,
      userType: decoded.userType,
      approvalStatus: decoded.approvalStatus,
    });
    const newRefreshToken = generateRefreshToken({
      adminId: decoded.adminId,
      email: decoded.email,
      userType: decoded.userType,
      approvalStatus: decoded.approvalStatus,
    });

    res.cookie("managerAccessToken", newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("managerRefreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
    });

    await createSession("manager", decoded.adminId, {
      email: decoded.email,
      userType: decoded.userType,
    });

    return decoded;
  } catch {
    return null;
  }
}

async function validateManagerStatus(decoded: TokenPayload, res: Response): Promise<boolean> {
  const [manager] = await db
    .select({
      approvalStatus: adminUsers.approvalStatus,
      status: adminUsers.status,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, decoded.adminId))
    .limit(1);

  if (!manager) {
    res.status(403).json({ message: "계정을 찾을 수 없습니다." });
    return false;
  }

  if (manager.approvalStatus !== "승인") {
    res.clearCookie("managerAccessToken");
    res.clearCookie("managerRefreshToken");
    res.status(403).json({ message: "승인되지 않은 계정입니다." });
    return false;
  }

  return true;
}

export async function managerAuthMiddleware(
  req: AuthenticatedManagerRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const accessToken = req.cookies?.managerAccessToken;

  if (!accessToken) {
    const refreshed = await tryRefreshManagerToken(req, res);
    if (refreshed) {
      if (refreshed.userType !== "매니저") {
        res.status(403).json({ message: "매니저 권한이 필요합니다." });
        return;
      }
      const valid = await validateManagerStatus(refreshed, res);
      if (!valid) return;
      req.manager = refreshed;
      next();
      return;
    }
    res.status(401).json({ message: "인증 토큰이 없습니다." });
    return;
  }

  try {
    const decoded = verifyAccessToken(accessToken);
    if (decoded.userType !== "매니저") {
      res.status(403).json({ message: "매니저 권한이 필요합니다." });
      return;
    }
    const valid = await validateManagerStatus(decoded, res);
    if (!valid) return;

    const sessionExists = await hasActiveSession("manager", decoded.adminId);
    if (!sessionExists) {
      await createSession("manager", decoded.adminId, {
        email: decoded.email,
        userType: decoded.userType,
      });
    } else {
      refreshSession("manager", decoded.adminId).catch(() => {});
    }

    req.manager = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      const refreshed = await tryRefreshManagerToken(req, res);
      if (refreshed) {
        if (refreshed.userType !== "매니저") {
          res.status(403).json({ message: "매니저 권한이 필요합니다." });
          return;
        }
        const valid = await validateManagerStatus(refreshed, res);
        if (!valid) return;
        req.manager = refreshed;
        next();
        return;
      }
    }
    res.status(401).json({ message: "유효하지 않거나 만료된 토큰입니다." });
  }
}
