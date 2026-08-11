import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/adminQueryClient";
import AdminLayout from "../adminLayout";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useToast } from "@/hooks/use-toast";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isToday,
  startOfMonth,
} from "date-fns";
import { ko } from "date-fns/locale";
import {
  matchManagementStatusBadgeClass,
  resolveMatchManagementStatusDisplay,
} from "@shared/matchManagementStatus";
import { getDisplayStadiumName } from "@shared/stadiumDisplay";
import { resolveMatchTeamNames } from "@shared/matchTeamDisplay";

interface Stadium {
  id: number;
  name: string;
}

interface MatchRow {
  id: string;
  name: string;
  stadiumId: number;
  startTime: string;
  endTime: string;
  matchStatus: string;
  matchDate?: string | null;
  apiSportsGameId?: number | null;
  apiSportsHomeTeam?: string | null;
  apiSportsAwayTeam?: string | null;
  apiSportsHomeTeamLogo?: string | null;
  apiSportsAwayTeamLogo?: string | null;
  liveScoreboard?: {
    homeScore?: number;
    awayScore?: number;
    statusShort?: string;
    statusLong?: string;
    inningLabel?: string;
    inning?: number | null;
    homeTeamLogo?: string | null;
    awayTeamLogo?: string | null;
  } | null;
}

const TEAM_AVATAR_COLORS = [
  "#E11936",
  "#1A6DFF",
  "#0F766E",
  "#7C3AED",
  "#C2410C",
  "#0369A1",
  "#BE185D",
  "#4B5563",
];

function kstDateKeyFromDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function kstDateKeyFromIso(iso: string): string {
  return kstDateKeyFromDate(new Date(iso));
}

/** 목록 — KST 실제 개시 시각(startTime) 기준 (matchDate 오표기 보정) */
function matchKstDateKey(match: MatchRow): string {
  if (match.startTime) return kstDateKeyFromIso(match.startTime);
  if (match.matchDate) return match.matchDate;
  return "";
}

function getKstTodayKey(): string {
  return kstDateKeyFromDate(new Date());
}

function formatTimeKst(iso: string): string {
  const utc = new Date(iso);
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return `${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}`;
}

function matchStatusDisplay(match: MatchRow): string {
  return resolveMatchManagementStatusDisplay({
    matchStatus: match.matchStatus,
    statusShort: match.liveScoreboard?.statusShort,
    statusLong: match.liveScoreboard?.statusLong,
    inningLabel: match.liveScoreboard?.inningLabel,
    homeScore: match.liveScoreboard?.homeScore,
    awayScore: match.liveScoreboard?.awayScore,
    inning: match.liveScoreboard?.inning,
  });
}

function statusBadgeClass(display: string): string {
  return matchManagementStatusBadgeClass(display);
}

function teamAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TEAM_AVATAR_COLORS[hash % TEAM_AVATAR_COLORS.length];
}

function teamAvatarLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  if (/^[A-Za-z]/.test(trimmed)) return trimmed.slice(0, 3).toUpperCase();
  return trimmed.slice(0, 2);
}

function TeamMark({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(logoUrl) && !imgFailed;

  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm overflow-hidden bg-white border border-[#E5E7EB]"
      style={showImg ? undefined : { backgroundColor: teamAvatarColor(name), borderColor: "transparent" }}
      aria-hidden
    >
      {showImg ? (
        <img
          src={logoUrl!}
          alt=""
          className="h-full w-full object-contain p-0.5"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      ) : (
        teamAvatarLabel(name)
      )}
    </span>
  );
}

function WinBadge() {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3B82F6] text-[10px] font-bold text-white"
      title="승리"
    >
      승
    </span>
  );
}

export default function MatchManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { assets } = useAdminAssets();
  const dayStripRef = useRef<HTMLDivElement | null>(null);

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [syncingDate, setSyncingDate] = useState<string | null>(null);
  const [lastSyncMeta, setLastSyncMeta] = useState<{
    date: string;
    created: number;
    updated: number;
    linked: number;
    deduped?: number;
    cleared?: number;
    source?: "cache" | "api";
  } | null>(null);

  const { data: stadiums } = useQuery<Stadium[]>({
    queryKey: ["/api/admin/stadiums"],
  });

  const { data: matchesData, isLoading: matchesLoading } = useQuery<MatchRow[]>({
    queryKey: ["/api/admin/matches"],
  });

  const datesWithMatches = useMemo(() => {
    const set = new Set<string>();
    for (const m of matchesData ?? []) {
      set.add(matchKstDateKey(m));
    }
    return set;
  }, [matchesData]);

  const matchCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matchesData ?? []) {
      const key = matchKstDateKey(m);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [matchesData]);

  const stadiumNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of stadiums ?? []) {
      map.set(s.id, s.name);
    }
    return map;
  }, [stadiums]);

  const monthDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(calendarMonth),
      end: endOfMonth(calendarMonth),
    });
  }, [calendarMonth]);

  const selectedDateKey = kstDateKeyFromDate(selectedDay);

  const dayMatches = useMemo(() => {
    if (!matchesData) return [];
    return matchesData
      .filter((m) => matchKstDateKey(m) === selectedDateKey)
      .sort((a, b) => {
        const ta = new Date(a.startTime).getTime();
        const tb = new Date(b.startTime).getTime();
        if (ta !== tb) return ta - tb;
        const an = parseInt(a.name.replace(/\D/g, ""), 10) || 0;
        const bn = parseInt(b.name.replace(/\D/g, ""), 10) || 0;
        return an - bn;
      });
  }, [matchesData, selectedDateKey]);

  useEffect(() => {
    const el = dayStripRef.current?.querySelector<HTMLElement>(
      `[data-date-key="${selectedDateKey}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedDateKey, calendarMonth]);

  const syncDate = async (
    dateKey: string,
    options?: { silentEmpty?: boolean; forceApi?: boolean },
  ) => {
    setSyncingDate(dateKey);
    try {
      const res = await apiRequest("POST", "/api/admin/matches/sync-from-api-sports", {
        date: dateKey,
        forceApi: options?.forceApi,
      });
      const body = await res.json();
      const created = body.created ?? 0;
      const updated = body.updated ?? 0;
      const linked = body.linked ?? 0;
      const deduped = body.deduped ?? 0;
      const cleared = body.cleared ?? 0;
      const source = body.source as "cache" | "api" | undefined;
      setLastSyncMeta({ date: dateKey, created, updated, linked, deduped, cleared, source });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/stadiums"] });

      if (linked === 0) {
        if (cleared > 0) {
          toast({
            description: `${dateKey} API 경기 없음 · DB orphan ${cleared}건 정리`,
          });
        } else if (!options?.silentEmpty) {
          toast({
            variant: "destructive",
            description: `${dateKey} API 경기가 없습니다. (키·시즌·리그 확인)`,
          });
        }
      } else {
        const sourceLabel = source === "cache" ? "DB 캐시" : source === "api" ? "API 조회" : "동기화";
        const dedupedPart = deduped > 0 ? ` · 중복 제거 ${deduped}` : "";
        toast({
          description: `${dateKey} ${sourceLabel} · 신규 ${created} · 갱신 ${updated} · 연결 ${linked}${dedupedPart}`,
        });
      }
      return body;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        variant: "destructive",
        description:
          message.includes("API_SPORTS_KEY")
            ? "Replit Secrets에 API_SPORTS_KEY가 없습니다."
            : message.includes("Free plans")
              ? "Free 플랜은 현재 시즌 조회가 불가합니다. Pro 키를 확인하세요."
              : `일정 불러오기 실패: ${message}`,
      });
      throw err;
    } finally {
      setSyncingDate(null);
    }
  };

  const selectDay = (day: Date) => {
    setSelectedDay(day);
    setCalendarMonth(startOfMonth(day));
  };

  const goToday = () => {
    const today = new Date();
    selectDay(today);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col flex-1 min-h-0 h-full w-full max-w-none">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 shrink-0">
          <h1
            className="text-lg lg:text-xl font-semibold text-[#201E22] flex items-center gap-2"
            data-testid="text-page-title"
          >
            <img src={assets.adMatchIcon} className="w-7 h-7 lg:w-8 lg:h-8 object-contain" alt="" />
            경기관리
          </h1>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded-md border border-[#E0E0E0] bg-white text-[#201E22] hover:border-[#E11936] hover:text-[#E11936] disabled:opacity-50"
              disabled={Boolean(syncingDate)}
              onClick={() => void syncDate(selectedDateKey, { forceApi: true })}
              data-testid="button-force-resync"
            >
              {syncingDate === selectedDateKey ? "불러오는 중..." : "API에서 갱신"}
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded-md bg-[#201E22] text-white disabled:opacity-50"
              disabled={Boolean(syncingDate)}
              onClick={goToday}
              data-testid="button-open-today"
            >
              오늘
            </button>
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 border border-[#D0D0D0] rounded-lg bg-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#E9E9E9] bg-[#FAFAFA] shrink-0">
            <button
              type="button"
              className="w-8 h-8 rounded-md border border-[#E0E0E0] bg-white flex items-center justify-center hover:border-[#E11936]"
              onClick={() => {
                const prev = addMonths(calendarMonth, -1);
                setCalendarMonth(prev);
                setSelectedDay(startOfMonth(prev));
              }}
              aria-label="이전 달"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base lg:text-lg font-bold text-[#201E22] tracking-tight">
              {format(calendarMonth, "yyyy.MM")}
            </h2>
            <button
              type="button"
              className="w-8 h-8 rounded-md border border-[#E0E0E0] bg-white flex items-center justify-center hover:border-[#E11936]"
              onClick={() => {
                const next = addMonths(calendarMonth, 1);
                setCalendarMonth(next);
                setSelectedDay(startOfMonth(next));
              }}
              aria-label="다음 달"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div
            ref={dayStripRef}
            className="shrink-0 flex gap-1 overflow-x-auto px-2 py-2 border-b border-[#E9E9E9] bg-white scrollbar-thin"
            data-testid="schedule-day-strip"
          >
            {monthDays.map((day) => {
              const key = kstDateKeyFromDate(day);
              const selected = isSameDay(day, selectedDay);
              const today = isToday(day);
              const count = matchCountByDate.get(key) ?? 0;
              const has = datesWithMatches.has(key);
              const dow = format(day, "EEE", { locale: ko }).replace("요일", "");
              return (
                <button
                  key={key}
                  type="button"
                  data-date-key={key}
                  data-testid={`calendar-day-${key}`}
                  onClick={() => selectDay(day)}
                  className={`relative flex min-w-[52px] flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition-colors ${
                    selected
                      ? "bg-[#E8F1FF] text-[#1A6DFF]"
                      : today
                        ? "bg-[#FFF7ED] text-[#C2410C] hover:bg-[#FFEDD5]"
                        : "text-[#6B7280] hover:bg-[#F5F5F5]"
                  }`}
                >
                  <span className="text-[11px] font-medium leading-none">{dow}</span>
                  <span
                    className={`text-base font-bold leading-none ${
                      selected ? "text-[#1A6DFF]" : today ? "text-[#C2410C]" : "text-[#201E22]"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {has ? (
                    <span
                      className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                        selected ? "bg-[#1A6DFF]" : "bg-[#9CA3AF]"
                      }`}
                      title={`${count}경기`}
                    />
                  ) : (
                    <span className="mt-0.5 h-1.5 w-1.5" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="px-4 py-2 border-b border-[#F0F0F0] shrink-0 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[#201E22]">
                {format(selectedDay, "yyyy년 M월 d일 (EEE)", { locale: ko })}
              </p>
              <p className="text-[11px] text-[#888] mt-0.5">
                {syncingDate === selectedDateKey
                  ? dayMatches.length > 0
                    ? "API 갱신 중..."
                    : "일정 불러오는 중..."
                  : lastSyncMeta?.date === selectedDateKey
                    ? `${lastSyncMeta.source === "api" ? "API 반영" : "DB 캐시 반영"} · 신규 ${lastSyncMeta.created} · 갱신 ${lastSyncMeta.updated} · 연결 ${lastSyncMeta.linked}${(lastSyncMeta.deduped ?? 0) > 0 ? ` · 중복 제거 ${lastSyncMeta.deduped}` : ""}`
                    : "DB 저장 일정 표시 · API 갱신은 「API에서 갱신」 · 오늘은 09:00 자동 sync"}
              </p>
            </div>
            <span className="text-xs text-[#6B7280] tabular-nums">
              {dayMatches.length}경기
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-auto" data-testid="schedule-match-list">
            {matchesLoading || (syncingDate === selectedDateKey && dayMatches.length === 0) ? (
              <div className="py-16 text-center text-[#888] text-sm">
                {matchesLoading ? "불러오는 중..." : "일정을 불러오는 중..."}
              </div>
            ) : dayMatches.length === 0 ? (
              <div className="py-16 text-center text-[#888] text-sm">
                이 날짜에 등록·연결된 경기가 없습니다.
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={Boolean(syncingDate)}
                    onClick={() => void syncDate(selectedDateKey, { forceApi: true })}
                    className="px-3 py-1.5 text-xs rounded-md border border-[#E0E0E0] hover:border-[#E11936] hover:text-[#E11936] disabled:opacity-50"
                  >
                    API에서 불러오기
                  </button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-[#EFEFEF]">
                {dayMatches.map((match, index) => {
                  const teams = resolveMatchTeamNames({
                    apiSportsAwayTeam: match.apiSportsAwayTeam,
                    apiSportsHomeTeam: match.apiSportsHomeTeam,
                    liveScoreboard: match.liveScoreboard,
                  });
                  const away = teams.awayTeamName || "원정팀";
                  const home = teams.homeTeamName || "홈팀";
                  const awayLogo =
                    match.liveScoreboard?.awayTeamLogo || match.apiSportsAwayTeamLogo || null;
                  const homeLogo =
                    match.liveScoreboard?.homeTeamLogo || match.apiSportsHomeTeamLogo || null;
                  const stadium =
                    getDisplayStadiumName(
                      stadiumNameById.get(match.stadiumId),
                      match.apiSportsHomeTeam,
                    ) || "-";
                  const awayScore = match.liveScoreboard?.awayScore;
                  const homeScore = match.liveScoreboard?.homeScore;
                  const hasScore = awayScore != null && homeScore != null;
                  const status = matchStatusDisplay(match);
                  const finished =
                    status.includes("종료") || match.matchStatus === "completed";
                  const awayWon = finished && hasScore && (awayScore as number) > (homeScore as number);
                  const homeWon = finished && hasScore && (homeScore as number) > (awayScore as number);

                  return (
                    <li
                      key={match.id}
                      className="px-3 sm:px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors"
                      data-testid={`schedule-match-row-${match.id}`}
                    >
                      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[64px_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-4">
                        <div className="text-sm font-semibold text-[#201E22] tabular-nums lg:text-center">
                          {formatTimeKst(match.startTime)}
                        </div>

                        <div className="flex items-center justify-between gap-2 min-w-0 lg:justify-end">
                          <div className="flex items-center gap-2 min-w-0">
                            {awayWon && <WinBadge />}
                            <TeamMark name={away} logoUrl={awayLogo} />
                            <div className="min-w-0">
                              <div className="font-semibold text-[#201E22] truncate">{away}</div>
                              <div className="text-[11px] text-[#9CA3AF] truncate">{match.name}</div>
                            </div>
                          </div>
                          <div className="text-xl font-bold tabular-nums text-[#201E22] w-8 text-right shrink-0">
                            {hasScore ? awayScore : "-"}
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center text-center gap-1 px-2">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium ${statusBadgeClass(status)}`}
                          >
                            {status}
                          </span>
                          <span className="text-xs text-[#4D4B4E] truncate max-w-full" title={stadium}>
                            {stadium}
                          </span>
                          <span className="text-[10px] text-[#9CA3AF]">
                            {match.apiSportsGameId ? "API 연결" : "API 미연결"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 min-w-0 lg:justify-start">
                          <div className="text-xl font-bold tabular-nums text-[#201E22] w-8 shrink-0">
                            {hasScore ? homeScore : "-"}
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <TeamMark name={home} logoUrl={homeLogo} />
                            <div className="min-w-0">
                              <div className="font-semibold text-[#201E22] truncate">{home}</div>
                              <div className="text-[11px] text-[#9CA3AF]">홈</div>
                            </div>
                            {homeWon && <WinBadge />}
                          </div>
                        </div>

                        <div className="flex items-center justify-end">
                          <Link
                            href={`/admin/match-monitoring/${encodeURIComponent(selectedDateKey)}?matchIndex=${index}`}
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-[#FECACA] text-[#E11936] hover:bg-[#FFF1F3]"
                          >
                            모니터링
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
