import bcrypt from "bcrypt";

/**
 * 비밀번호 저장값 정규화.
 * 입력한 비밀번호를 그대로 저장한다 (ASCII 코드 변환 없음).
 * 레거시 ASCII 코드 문자열은 verify/decode 경로에서만 처리한다.
 */
export function encodePasswordAscii(plain: string): string {
  return plain;
}

/** 레거시: "97,98" 형태인지 여부 */
export function isAsciiEncodedPassword(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && /^\d+(,\d+)*$/.test(trimmed);
}

/** ASCII 코드 문자열을 평문으로 복원. ASCII 형식이 아니면 원문 그대로 반환 */
export function decodePasswordAscii(value: string): string {
  if (!value) return "";
  if (!isAsciiEncodedPassword(value)) return value;
  return value
    .split(",")
    .map((n) => String.fromCharCode(Number(n)))
    .join("");
}

/** 저장된 비밀번호(bcrypt / 레거시 ASCII 코드 / 평문)와 입력값 비교 — 로그인·본인확인 공통 */
export async function verifyStoredPassword(stored: string, input: string): Promise<boolean> {
  if (
    stored.startsWith("$2b$") ||
    stored.startsWith("$2a$") ||
    stored.startsWith("$2y$")
  ) {
    return bcrypt.compare(input, stored);
  }
  if (isAsciiEncodedPassword(stored)) {
    return decodePasswordAscii(stored) === input;
  }
  return stored === input;
}

export async function verifyAdminPassword(stored: string, input: string): Promise<boolean> {
  return verifyStoredPassword(stored, input);
}

export function resolveAdminPasswordPlain(storedPassword?: string | null, passwordPlain?: string | null): string {
  if (passwordPlain) return decodePasswordAscii(passwordPlain);
  const pw = storedPassword ?? "";
  if (pw.startsWith("$2")) return "";
  return decodePasswordAscii(pw);
}
