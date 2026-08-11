import type { Request, Response, NextFunction } from "express";
import { verifyUserAccessToken, type UserTokenPayload } from "../utils/jwt";
import { UserModel } from "../UserStorage/db";
import {
  assertUserSession,
  SESSION_REPLACED_CODE,
  SESSION_REPLACED_MESSAGE,
} from "../userAuthSession";
import { refreshSession } from "../sessionManager";

export interface AuthenticatedUserRequest extends Request {
  user?: UserTokenPayload;
}

async function updateLastActive(userId: string): Promise<void> {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    await UserModel.updateOne(
      {
        id: userId,
        $or: [{ lastActive: null }, { lastActive: { $lt: oneMinuteAgo } }],
      },
      { $set: { lastActive: new Date() } },
    );
  } catch (error) {
    console.error("Failed to update lastActive:", error);
  }
}

export async function userAuthMiddleware(
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "인증 토큰이 없습니다." });
      return;
    }

    const accessToken = authHeader.substring(7);
    const decoded = verifyUserAccessToken(accessToken);

    const sessionCheck = await assertUserSession(decoded.userId, decoded.sessionId);
    if (sessionCheck === "replaced") {
      res.status(401).json({
        message: SESSION_REPLACED_MESSAGE,
        code: SESSION_REPLACED_CODE,
      });
      return;
    }
    if (sessionCheck === "ok") {
      await refreshSession("user", decoded.userId).catch(() => {});
    }
    // unavailable(Redis 장애) — JWT만으로 통과 (가용성 우선)

    req.user = decoded;

    if (decoded.userId) {
      void updateLastActive(decoded.userId);
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "유효하지 않거나 만료된 토큰입니다." });
  }
}
