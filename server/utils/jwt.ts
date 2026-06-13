import jwt from "jsonwebtoken";

// JWT 시크릿은 환경 변수에서 필수로 가져오기
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables");
}

const JWT_SECRET: string = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET;

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const MANAGER_REFRESH_TOKEN_EXPIRY = "30d";

export interface TokenPayload {
  adminId: string;
  email: string;
  userType: string;
  approvalStatus: string;
}

export interface UserTokenPayload {
  userId: string;
  username: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: MANAGER_REFRESH_TOKEN_EXPIRY,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    // TokenExpiredError를 직접 throw하여 미들웨어에서 구분 가능하도록 함
    if (error instanceof jwt.TokenExpiredError) {
      throw error;
    }
    throw new Error("Invalid access token");
  }
}

export function verifyRefreshToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
  } catch (error) {
    throw new Error("Invalid or expired refresh token");
  }
}

export function generateUserAccessToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function generateUserRefreshToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

export function verifyUserAccessToken(token: string): UserTokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as UserTokenPayload;
  } catch (error) {
    throw new Error("Invalid or expired access token");
  }
}

export function verifyUserRefreshToken(token: string): UserTokenPayload {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as UserTokenPayload;
  } catch (error) {
    throw new Error("Invalid or expired refresh token");
  }
}
