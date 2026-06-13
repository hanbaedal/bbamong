import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { verifyAccessToken, verifyRefreshToken, generateAccessToken, generateRefreshToken, type TokenPayload } from "../utils/jwt";
import { AdminUserModel } from "../UserStorage/db";

export interface AuthenticatedAdminRequest extends Request {
  admin?: TokenPayload;
}

async function tryRefreshAdminToken(req: Request, res: Response): Promise<TokenPayload | null> {
  const refreshToken = req.cookies?.adminRefreshToken;
  if (!refreshToken) return null;

  try {
    const decoded = verifyRefreshToken(refreshToken);

    const admin = await AdminUserModel.findOne({ id: decoded.adminId })
      .select("id email userType approvalStatus status")
      .lean();

    if (!admin || admin.approvalStatus !== "승인") {
      res.clearCookie("adminAccessToken");
      res.clearCookie("adminRefreshToken");
      return null;
    }

    if (admin.status === "비활성화") {
      res.clearCookie("adminAccessToken");
      res.clearCookie("adminRefreshToken");
      return null;
    }

    const tokenPayload: TokenPayload = {
      adminId: admin.id,
      email: admin.email,
      userType: admin.userType,
      approvalStatus: admin.approvalStatus,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    res.cookie("adminAccessToken", newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("adminRefreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return tokenPayload;
  } catch {
    res.clearCookie("adminAccessToken");
    res.clearCookie("adminRefreshToken");
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
    req.admin = decoded;
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
    req.admin = decoded;
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
