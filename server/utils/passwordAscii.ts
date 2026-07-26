import bcrypt from "bcrypt";

/** 비밀번호를 MongoDB 저장용 ASCII 코드 문자열로 변환 (예: "ab" → "97,98") */
export function encodePasswordAscii(plain: string): string {
  return [...plain].map((ch) => ch.charCodeAt(0)).join(",");
}

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

export async function verifyAdminPassword(stored: string, input: string): Promise<boolean> {
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
    return bcrypt.compare(input, stored);
  }
  if (isAsciiEncodedPassword(stored)) {
    return decodePasswordAscii(stored) === input;
  }
  return stored === input;
}

export function resolveAdminPasswordPlain(storedPassword?: string | null, passwordPlain?: string | null): string {
  if (passwordPlain) return decodePasswordAscii(passwordPlain);
  const pw = storedPassword ?? "";
  if (pw.startsWith("$2")) return "";
  return decodePasswordAscii(pw);
}
