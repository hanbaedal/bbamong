import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, verifyUserAccessToken, type TokenPayload, type UserTokenPayload } from "../utils/jwt";

export interface MultiRoleAuthRequest extends Request {
  auth?: {
    role: "user" | "admin" | "manager";
    subjectId: string;
    displayName: string;
    userType?: string;
    approvalStatus?: string;
  };
}

export function multiRoleAuthMiddleware(
  req: MultiRoleAuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // 1. Cookie에서 토큰 확인
    let userToken = req.cookies?.userAccessToken;
    const adminToken = req.cookies?.adminAccessToken;
    const managerToken = req.cookies?.managerAccessToken;
    
    // 2. Authorization Bearer 헤더에서 토큰 확인 (모바일 앱용)
    const authHeader = req.headers.authorization;
    if (!userToken && authHeader && authHeader.startsWith('Bearer ')) {
      userToken = authHeader.substring(7);
    }
    
    // 3. Query parameter에서 토큰 확인 (SSE용 - EventSource는 헤더 지원 안함)
    if (!userToken && req.query.token) {
      userToken = req.query.token as string;
    }

    // 토큰 우선순위: user > admin > manager
    if (userToken) {
      const decoded: UserTokenPayload = verifyUserAccessToken(userToken);
      
      req.auth = {
        role: "user",
        subjectId: decoded.userId,
        displayName: decoded.username,
      };
    } else if (adminToken) {
      const decoded: TokenPayload = verifyAccessToken(adminToken);
      
      // 관리자 승인 상태 확인
      if (decoded.approvalStatus !== "승인") {
        res.status(403).json({ message: "승인되지 않은 관리자 계정입니다." });
        return;
      }
      
      req.auth = {
        role: "admin",
        subjectId: decoded.adminId,
        displayName: decoded.email,
        userType: decoded.userType,
        approvalStatus: decoded.approvalStatus,
      };
    } else if (managerToken) {
      const decoded: TokenPayload = verifyAccessToken(managerToken);
      
      // 매니저 타입 및 승인 상태 확인
      if (decoded.userType !== "매니저") {
        res.status(403).json({ message: "매니저 권한이 필요합니다." });
        return;
      }
      
      if (decoded.approvalStatus !== "승인") {
        res.status(403).json({ message: "승인되지 않은 매니저 계정입니다." });
        return;
      }
      
      req.auth = {
        role: "manager",
        subjectId: decoded.adminId,
        displayName: decoded.email,
        userType: decoded.userType,
        approvalStatus: decoded.approvalStatus,
      };
    } else {
      res.status(401).json({ message: "인증 토큰이 없습니다." });
      return;
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "유효하지 않거나 만료된 토큰입니다." });
  }
}
