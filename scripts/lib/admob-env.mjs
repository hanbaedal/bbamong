const KEY_PATTERNS = {
  ADMOB_CLIENT_ID: /ADMOB_CLIENT_ID\s*=\s*([^\s\r\n]+)/i,
  ADMOB_CLIENT_SECRET: /ADMOB_CLIENT_SECRET\s*=\s*([^\s\r\n]+)/i,
  ADMOB_PUBLISHER_ID: /ADMOB_PUBLISHER_ID\s*=\s*([^\s\r\n]+)/i,
  ADMOB_REFRESH_TOKEN: /ADMOB_REFRESH_TOKEN\s*=\s*(\S+)/i,
};

/** Google OAuth / AdMob 값 형식에서 직접 추출 */
const CANONICAL = {
  ADMOB_CLIENT_ID: /\d{8,}-[a-z0-9]+\.apps\.googleusercontent\.com/i,
  ADMOB_CLIENT_SECRET: /GOCSPX-[A-Za-z0-9_-]+/,
  ADMOB_PUBLISHER_ID: /pub-\d+/i,
  ADMOB_REFRESH_TOKEN: /1\/\/[A-Za-z0-9_-]+/,
};

function collectEnvBlob() {
  const parts = [
    process.env.ADMOB_CLIENT_ID,
    process.env.ADMOB_CLIENT_SECRET,
    process.env.ADMOB_PUBLISHER_ID,
    process.env.ADMOB_REFRESH_TOKEN,
    process.env.ADMOB_SECRETS,
    process.env.SECRETS,
  ].filter((v) => typeof v === "string" && v.trim());

  return parts.join("\n");
}

function extractCanonical(name, raw) {
  const canonical = raw.match(CANONICAL[name]);
  if (canonical?.[0]) return canonical[0];

  const keyed = raw.match(KEY_PATTERNS[name]);
  if (keyed?.[1]) {
    const inner = keyed[1].trim().replace(/^["']|["']$/g, "");
    const innerCanonical = inner.match(CANONICAL[name]);
    if (innerCanonical?.[0]) return innerCanonical[0];
    return inner;
  }

  return "";
}

function readAdmobVar(name) {
  const direct = (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "");
  const blob = collectEnvBlob();

  const fromDirect = extractCanonical(name, direct);
  if (fromDirect && CANONICAL[name].test(fromDirect)) {
    return fromDirect;
  }

  const fromBlob = extractCanonical(name, blob);
  if (fromBlob && CANONICAL[name].test(fromBlob)) {
    return fromBlob;
  }

  const linePrefix = `${name}=`;
  if (direct.startsWith(linePrefix)) {
    return direct.slice(linePrefix.length).trim().replace(/^["']|["']$/g, "");
  }

  return fromDirect || fromBlob || direct;
}

export function getAdmobEnv() {
  return {
    clientId: readAdmobVar("ADMOB_CLIENT_ID"),
    clientSecret: readAdmobVar("ADMOB_CLIENT_SECRET"),
    publisherId: readAdmobVar("ADMOB_PUBLISHER_ID"),
    refreshToken: readAdmobVar("ADMOB_REFRESH_TOKEN"),
  };
}

export function validateAdmobEnv(env = getAdmobEnv()) {
  const errors = [];

  if (!CANONICAL.ADMOB_CLIENT_ID.test(env.clientId)) {
    errors.push(
      `ADMOB_CLIENT_ID 형식 오류 (숫자-문자.apps.googleusercontent.com 필요). 현재 앞 30자: ${JSON.stringify(env.clientId.slice(0, 30))}`,
    );
  }
  if (!CANONICAL.ADMOB_CLIENT_SECRET.test(env.clientSecret)) {
    errors.push("ADMOB_CLIENT_SECRET 형식 오류 (GOCSPX- 로 시작해야 함)");
  }
  if (!CANONICAL.ADMOB_PUBLISHER_ID.test(env.publisherId)) {
    errors.push("ADMOB_PUBLISHER_ID 형식 오류 (pub-숫자)");
  }
  if (!CANONICAL.ADMOB_REFRESH_TOKEN.test(env.refreshToken)) {
    errors.push("ADMOB_REFRESH_TOKEN 형식 오류 (1// 로 시작)");
  }

  return errors;
}

export function getAdmobEnvMisconfigurationHint() {
  const rawId = process.env.ADMOB_CLIENT_ID?.trim() ?? "";
  if (
    rawId.includes("ADMOB_CLIENT_SECRET") ||
    rawId.includes("ADMOB_PUBLISHER_ID") ||
    rawId.includes("ADMOB_REFRESH_TOKEN") ||
    (rawId.includes(" ") && rawId.includes("="))
  ) {
    return [
      "Replit Secrets에 .env 전체를 한 칸에 넣으신 것 같습니다.",
      "키 4개를 각각 따로 만드세요 (값에는 = 뒤 내용만).",
      "  ADMOB_CLIENT_ID     → 782334080758-....apps.googleusercontent.com",
      "  ADMOB_CLIENT_SECRET → GOCSPX-....",
      "  ADMOB_PUBLISHER_ID  → pub-4891329765213425",
      "  ADMOB_REFRESH_TOKEN → 1//04....",
    ].join("\n");
  }
  return null;
}
