import type { Request } from "express";

const regionCache = new Map<string, string>();
const CACHE_MAX = 500;

function normalizeIp(raw: string): string {
  let ip = raw.trim();
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }
  return ip;
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (!ip || ip === "unknown") return true;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  return false;
}

/** Replit/프록시 환경에서 클라이언트 IP 추출 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return normalizeIp(String(forwarded[0]).trim());
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return normalizeIp(realIp.trim());
  }

  const socketIp = req.socket?.remoteAddress;
  if (socketIp) return normalizeIp(socketIp);

  return "unknown";
}

function formatRegion(country: string, regionName: string, city: string): string {
  const countryPart = country.trim();
  const cityPart = (city || regionName).trim();
  if (countryPart && cityPart) return `${countryPart} · ${cityPart}`;
  if (countryPart) return countryPart;
  if (cityPart) return cityPart;
  return "알 수 없음";
}

/** IP 기반 대략적 지역 조회 (실패해도 로그인 차단하지 않음) */
export async function lookupIpRegion(ip: string): Promise<string> {
  const normalized = normalizeIp(ip);
  if (isPrivateOrLocalIp(normalized)) {
    return "로컬/내부망";
  }

  const cached = regionCache.get(normalized);
  if (cached) return cached;

  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(normalized)}?fields=status,country,regionName,city&lang=ko`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      return "알 수 없음";
    }

    const data = (await res.json()) as {
      status?: string;
      country?: string;
      regionName?: string;
      city?: string;
    };

    if (data.status !== "success") {
      return "알 수 없음";
    }

    const region = formatRegion(data.country ?? "", data.regionName ?? "", data.city ?? "");

    if (regionCache.size >= CACHE_MAX) {
      const firstKey = regionCache.keys().next().value;
      if (firstKey) regionCache.delete(firstKey);
    }
    regionCache.set(normalized, region);
    return region;
  } catch (error) {
    console.warn(`[clientGeo] IP region lookup failed for ${normalized}:`, error);
    return "알 수 없음";
  }
}

export async function resolveClientLoginGeo(req: Request): Promise<{ ip: string; region: string }> {
  const ip = getClientIp(req);
  const region = await lookupIpRegion(ip);
  return { ip, region };
}
