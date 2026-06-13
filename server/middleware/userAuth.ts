import type { Request, Response, NextFunction } from "express";
import { verifyUserAccessToken, type UserTokenPayload } from "../utils/jwt";
import { db } from "../UserStorage/db";
import { sql } from "drizzle-orm";

export interface AuthenticatedUserRequest extends Request {
  user?: UserTokenPayload;
}

// lastActive 업데이트 (1분 쓰로틀링 - 비동기, 에러 무시)
async function updateLastActive(userId: string): Promise<void> {
  try {
    // SQL에서 직접 시간 계산하여 쓰로틀링
    await db.execute(sql`
      UPDATE users 
      SET last_active_at = NOW()
      WHERE id = ${userId} 
        AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL '60 seconds')
    `);
  } catch (error) {
    // lastActive 업데이트 실패해도 요청 처리는 계속 진행
    console.error("Failed to update lastActive:", error);
  }
}

export function userAuthMiddleware(
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // Bearer Token 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "인증 토큰이 없습니다." });
      return;
    }

    const accessToken = authHeader.substring(7); // "Bearer " 제거

    const decoded = verifyUserAccessToken(accessToken);
    
    req.user = decoded;
    
    // 비동기로 lastActive 업데이트 (응답 지연 없음)
    if (decoded.userId) {
      updateLastActive(decoded.userId);
    }
    
    next();
  } catch (error) {
    res.status(401).json({ message: "유효하지 않거나 만료된 토큰입니다." });
  }
}
