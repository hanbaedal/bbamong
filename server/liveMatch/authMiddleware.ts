import { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const admin = (req as any).admin;

  if (!admin) {
    return res.status(401).json({ message: "인증이 필요합니다." });
  }

  if (admin.userType !== "슈퍼어드민" && admin.userType !== "일반어드민") {
    return res.status(403).json({ message: "권한이 없습니다." });
  }

  next();
}

export function requireManager(req: Request, res: Response, next: NextFunction) {
  const admin = (req as any).admin;

  if (!admin) {
    return res.status(401).json({ message: "인증이 필요합니다." });
  }

  if (admin.userType !== "매니저") {
    return res.status(403).json({ message: "권한이 없습니다." });
  }

  next();
}