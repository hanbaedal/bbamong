const PATTERNS = {
  ADMOB_CLIENT_ID: /ADMOB_CLIENT_ID\s*=\s*([^\s\r\n]+)/i,
  ADMOB_CLIENT_SECRET: /ADMOB_CLIENT_SECRET\s*=\s*([^\s\r\n]+)/i,
  ADMOB_PUBLISHER_ID: /ADMOB_PUBLISHER_ID\s*=\s*([^\s\r\n]+)/i,
  ADMOB_REFRESH_TOKEN: /ADMOB_REFRESH_TOKEN\s*=\s*(\S+)/i,
};

function readAdmobVar(name) {
  let value = (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "");

  const linePrefix = `${name}=`;
  if (value.startsWith(linePrefix)) {
    value = value.slice(linePrefix.length).trim();
  }

  if (value.includes("ADMOB_") && PATTERNS[name]) {
    const match = value.match(PATTERNS[name]);
    if (match?.[1]) {
      value = match[1].trim();
    }
  }

  return value.replace(/^["']|["']$/g, "");
}

export function getAdmobEnv() {
  return {
    clientId: readAdmobVar("ADMOB_CLIENT_ID"),
    clientSecret: readAdmobVar("ADMOB_CLIENT_SECRET"),
    publisherId: readAdmobVar("ADMOB_PUBLISHER_ID"),
    refreshToken: readAdmobVar("ADMOB_REFRESH_TOKEN"),
  };
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
      "아래처럼 키 4개를 각각 따로 만드세요 (값에는 = 뒤 내용만).",
      "  ADMOB_CLIENT_ID     → 782334080758-....apps.googleusercontent.com",
      "  ADMOB_CLIENT_SECRET → GOCSPX-....",
      "  ADMOB_PUBLISHER_ID  → pub-4891329765213425",
      "  ADMOB_REFRESH_TOKEN → 1//04....",
    ].join("\n");
  }
  return null;
}
