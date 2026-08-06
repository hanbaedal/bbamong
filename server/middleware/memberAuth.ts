import type { Response, NextFunction } from "express";
import { UserModel } from "../UserStorage/db";
import { verifyUserAccessToken } from "../utils/jwt";
import type { AuthenticatedUserRequest } from "./userAuth";

/** 정회원 전용 — 게스트·무인증 차단 */
export async function memberAuthMiddleware(
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ message: "인증 토큰이 없습니다." });
      return;
    }

    const decoded = verifyUserAccessToken(authHeader.substring(7));
    req.user = decoded;

    const userDoc = await UserModel.findOne({ id: decoded.userId })
      .select("provider isSuspended")
      .lean();
    if (!userDoc) {
      res.status(401).json({ message: "사용자를 찾을 수 없습니다." });
      return;
    }
    if (userDoc.provider === "guest") {
      res.status(403).json({ message: "로그인 후 이용해주세요." });
      return;
    }
    if (userDoc.isSuspended === 1) {
      res.status(403).json({ message: "이용이 제한된 계정입니다." });
      return;
    }

    next();
  } catch {
    res.status(401).json({ message: "유효하지 않거나 만료된 토큰입니다." });
  }
}
