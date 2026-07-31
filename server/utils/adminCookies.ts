import type { CookieOptions, Response } from "express";

export const ADMIN_AUTH_COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
};

export function setAdminAccessCookie(res: Response, token: string): void {
  res.cookie("adminAccessToken", token, {
    ...ADMIN_AUTH_COOKIE_OPTS,
    maxAge: 15 * 60 * 1000,
  });
}

export function setAdminRefreshCookie(res: Response, token: string): void {
  res.cookie("adminRefreshToken", token, {
    ...ADMIN_AUTH_COOKIE_OPTS,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAdminAuthCookies(res: Response): void {
  res.clearCookie("adminAccessToken", ADMIN_AUTH_COOKIE_OPTS);
  res.clearCookie("adminRefreshToken", ADMIN_AUTH_COOKIE_OPTS);
}
