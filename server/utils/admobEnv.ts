const KEY_PATTERNS: Record<string, RegExp> = {
  ADMOB_CLIENT_ID: /ADMOB_CLIENT_ID\s*=\s*([^\s\r\n]+)/i,
  ADMOB_CLIENT_SECRET: /ADMOB_CLIENT_SECRET\s*=\s*([^\s\r\n]+)/i,
  ADMOB_PUBLISHER_ID: /ADMOB_PUBLISHER_ID\s*=\s*([^\s\r\n]+)/i,
  ADMOB_REFRESH_TOKEN: /ADMOB_REFRESH_TOKEN\s*=\s*(\S+)/i,
};

const CANONICAL: Record<string, RegExp> = {
  ADMOB_CLIENT_ID: /\d{8,}-[a-z0-9]+\.apps\.googleusercontent\.com/i,
  ADMOB_CLIENT_SECRET: /GOCSPX-[A-Za-z0-9_-]+/,
  ADMOB_PUBLISHER_ID: /pub-\d+/i,
  ADMOB_REFRESH_TOKEN: /1\/\/[A-Za-z0-9_-]+/,
};

function collectEnvBlob(): string {
  const parts = [
    process.env.ADMOB_CLIENT_ID,
    process.env.ADMOB_CLIENT_SECRET,
    process.env.ADMOB_PUBLISHER_ID,
    process.env.ADMOB_REFRESH_TOKEN,
    process.env.ADMOB_SECRETS,
    process.env.SECRETS,
  ].filter((v): v is string => typeof v === "string" && v.trim());

  return parts.join("\n");
}

function extractCanonical(name: string, raw: string): string {
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

function readAdmobVar(name: string): string {
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
