const PATTERNS: Record<string, RegExp> = {
  ADMOB_CLIENT_ID: /ADMOB_CLIENT_ID\s*=\s*([^\s\r\n]+)/i,
  ADMOB_CLIENT_SECRET: /ADMOB_CLIENT_SECRET\s*=\s*([^\s\r\n]+)/i,
  ADMOB_PUBLISHER_ID: /ADMOB_PUBLISHER_ID\s*=\s*([^\s\r\n]+)/i,
  ADMOB_REFRESH_TOKEN: /ADMOB_REFRESH_TOKEN\s*=\s*(\S+)/i,
};

function readAdmobVar(name: string): string {
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
