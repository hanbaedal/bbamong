import { useMemo, useState } from "react";
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
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ko } from "date-fns/locale";

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
  liveScoreboard?: {
    homeScore?: number;
    awayScore?: number;
    statusLong?: string;
    inningLabel?: string;
  } | null;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function matchDateKey(match: MatchRow): string {
  if (match.matchDate) return match.matchDate;
  const utc = new Date(match.startTime);
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

function formatTimeKst(iso: string): string {
  const utc = new Date(iso);
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return `${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}`;
}

function statusLabel(status: string): string {
  if (status === "completed" || status === "종료") return "종료";
  if (status === "ongoing" || status === "진행") return "진행";
  if (status === "cancelled" || status === "취소") return "취소";
  return "예정";
}

export default function MatchManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { assets } = useAdminAssets();

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | undefined>();
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [syncingDate, setSyncingDate] = useState<string | null>(null);
  const [lastSyncMeta, setLastSyncMeta] = useState<{
    date: string;
    created: number;
    updated: number;
    linked: number;
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
      set.add(matchDateKey(m));
    }
    return set;
  }, [matchesData]);

  const matchCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matchesData ?? []) {
      const key = matchDateKey(m);
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

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [calendarMonth]);

  const selectedDateKey = selectedDay ? toDateKey(selectedDay) : null;

  const dayMatches = useMemo(() => {
    if (!selectedDateKey || !matchesData) return [];
    return matchesData
      .filter((m) => matchDateKey(m) === selectedDateKey)
      .sort((a, b) => {
        const an = parseInt(a.name.replace(/\D/g, ""), 10) || 0;
        const bn = parseInt(b.name.replace(/\D/g, ""), 10) || 0;
        return an - bn;
      });
  }, [matchesData, selectedDateKey]);

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
      const source = body.source as "cache" | "api" | undefined;
      setLastSyncMeta({ date: dateKey, created, updated, linked, source });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/stadiums"] });

      if (linked === 0) {
        if (!options?.silentEmpty) {
          toast({
            variant: "destructive",
            description: `${dateKey} API 경기가 없습니다. (키·시즌·리그 확인)`,
          });
        }
      } else {
        const sourceLabel = source === "cache" ? "DB 캐시" : source === "api" ? "API 조회" : "동기화";
        toast({
          description: `${dateKey} ${sourceLabel} · 신규 ${created} · 갱신 ${updated} · 연결 ${linked}`,
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

  const openDay = async (day: Date | undefined, options?: { forceApi?: boolean; sync?: boolean }) => {
    if (!day) return;
    setSelectedDay(day);
    setDayModalOpen(true);
    if (options?.sync === false) return;
    const dateKey = toDateKey(day);
    await syncDate(dateKey, { silentEmpty: true, forceApi: options?.forceApi });
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
              className="px-3 py-1.5 text-xs rounded-md bg-[#201E22] text-white disabled:opacity-50"
              disabled={Boolean(syncingDate)}
              onClick={() => void openDay(new Date(), { sync: false })}
              data-testid="button-open-today"
            >
              {syncingDate ? "불러오는 중..." : "오늘"}
            </button>
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 border border-[#D0D0D0] rounded-lg bg-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#E9E9E9] bg-[#FAFAFA] shrink-0">
            <button
              type="button"
              className="w-8 h-8 rounded-md border border-[#E0E0E0] bg-white flex items-center justify-center hover:border-[#E11936]"
              onClick={() => setCalendarMonth((m) => addMonths(m, -1))}
              aria-label="이전 달"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base lg:text-lg font-bold text-[#201E22] tracking-tight">
              {format(calendarMonth, "yyyy년 M월", { locale: ko })}
            </h2>
            <button
              type="button"
              className="w-8 h-8 rounded-md border border-[#E0E0E0] bg-white flex items-center justify-center hover:border-[#E11936]"
              onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
              aria-label="다음 달"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {matchesLoading ? (
            <div className="flex-1 min-h-[240px] animate-pulse bg-[#F3F3F3]" />
          ) : (
            <div
              className="flex-1 min-h-0 p-2 lg:p-3 grid grid-cols-7 border-t border-[#E9E9E9]"
              style={{
                gridTemplateRows: `auto repeat(${Math.ceil(calendarDays.length / 7)}, minmax(0, 1fr))`,
              }}
            >
              {["일", "월", "화", "수", "목", "금", "토"].map((label, i) => (
                <div
                  key={label}
                  className={`py-1 text-center text-[11px] lg:text-xs font-semibold border-b border-[#E9E9E9] bg-[#F5F5F5] ${
                    i < 6 ? "border-r border-[#E9E9E9]" : ""
                  } ${i === 0 ? "text-[#E11936]" : i === 6 ? "text-[#2563EB]" : "text-[#4D4B4E]"}`}
                >
                  {label}
                </div>
              ))}
              {calendarDays.map((day, idx) => {
                const key = toDateKey(day);
                const inMonth = isSameMonth(day, calendarMonth);
                const count = matchCountByDate.get(key) ?? 0;
                const has = datesWithMatches.has(key);
                const selected = selectedDay ? isSameDay(day, selectedDay) : false;
                const today = isToday(day);
                const col = idx % 7;
                return (
                  <button
                    key={key + String(idx)}
                    type="button"
                    onClick={() => void openDay(day)}
                    className={`min-h-0 h-full p-1 lg:p-1.5 text-left border-b border-[#E9E9E9] transition-colors ${
                      col < 6 ? "border-r border-[#E9E9E9]" : ""
                    } ${
                      selected
                        ? "bg-[#FFF1F3] ring-2 ring-inset ring-[#E11936]"
                        : today
                          ? "bg-[#FFFBEB]"
                          : inMonth
                            ? "bg-white hover:bg-[#F9F9F9]"
                            : "bg-[#F7F7F7] hover:bg-[#F0F0F0]"
                    }`}
                    data-testid={`calendar-day-${key}`}
                  >
                    <div className="flex items-start justify-between gap-0.5">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 lg:w-7 lg:h-7 rounded text-[11px] lg:text-xs font-semibold ${
                          today
                            ? "bg-[#E11936] text-white"
                            : !inMonth
                              ? "text-[#BFBFBF]"
                              : col === 0
                                ? "text-[#E11936]"
                                : col === 6
                                  ? "text-[#2563EB]"
                                  : "text-[#201E22]"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                      {has && (
                        <span className="text-[9px] lg:text-[10px] font-semibold px-1 py-0.5 rounded bg-[#201E22] text-white leading-none">
                          {count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {dayModalOpen && selectedDay && selectedDateKey && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setDayModalOpen(false)}
          data-testid="modal-day-matches"
        >
          <div
            className="bg-white rounded-[12px] w-full max-w-[960px] max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9E9E9]">
              <div>
                <h2 className="text-lg font-semibold text-[#201E22]">
                  {format(selectedDay, "yyyy년 M월 d일 (EEE)", { locale: ko })} 경기
                </h2>
                <p className="text-xs text-[#888] mt-1">
                  {syncingDate === selectedDateKey
                    ? "일정 불러오는 중..."
                    : lastSyncMeta?.date === selectedDateKey
                      ? `${lastSyncMeta.source === "api" ? "API 반영" : "DB 캐시 반영"} · 신규 ${lastSyncMeta.created} · 갱신 ${lastSyncMeta.updated} · 연결 ${lastSyncMeta.linked}`
                      : "매일 09:00 오늘 경기 자동 저장 · 시작=상태 · 종료=스코어"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={syncingDate === selectedDateKey}
                  onClick={() => selectedDateKey && void syncDate(selectedDateKey, { forceApi: true })}
                  className="px-3 py-1.5 text-xs rounded-md border border-[#E9E9E9] hover:border-[#E11936] hover:text-[#E11936] disabled:opacity-50"
                  data-testid="button-force-resync"
                >
                  {syncingDate === selectedDateKey ? "불러오는 중..." : "API에서 갱신"}
                </button>
                <button
                  type="button"
                  onClick={() => setDayModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-[#201E22]"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-auto px-4 py-3">
              {syncingDate === selectedDateKey && dayMatches.length === 0 ? (
                <div className="py-16 text-center text-[#888] text-sm">일정을 불러오는 중...</div>
              ) : dayMatches.length === 0 ? (
                <div className="py-16 text-center text-[#888] text-sm">
                  이 날짜에 등록·연결된 경기가 없습니다.
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#F9F9F9] text-[#4D4B4E] text-left">
                      <th className="px-3 py-2 font-medium">시간</th>
                      <th className="px-3 py-2 font-medium">경기</th>
                      <th className="px-3 py-2 font-medium">구장</th>
                      <th className="px-3 py-2 font-medium">원정</th>
                      <th className="px-3 py-2 font-medium text-center">스코어</th>
                      <th className="px-3 py-2 font-medium">홈</th>
                      <th className="px-3 py-2 font-medium">상태</th>
                      <th className="px-3 py-2 font-medium">API</th>
                      <th className="px-3 py-2 font-medium">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayMatches.map((match, index) => {
                      const away = match.apiSportsAwayTeam || "원정팀";
                      const home = match.apiSportsHomeTeam || "홈팀";
                      const stadium = stadiumNameById.get(match.stadiumId) || "-";
                      const awayScore = match.liveScoreboard?.awayScore;
                      const homeScore = match.liveScoreboard?.homeScore;
                      const scoreText =
                        awayScore != null && homeScore != null
                          ? `${awayScore} : ${homeScore}`
                          : "-";
                      return (
                        <tr key={match.id} className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA]">
                          <td className="px-3 py-3 whitespace-nowrap">{formatTimeKst(match.startTime)}</td>
                          <td className="px-3 py-3 font-medium text-[#201E22]">{match.name}</td>
                          <td className="px-3 py-3 text-[#4D4B4E] max-w-[120px] truncate" title={stadium}>
                            {stadium}
                          </td>
                          <td className="px-3 py-3">{away}</td>
                          <td className="px-3 py-3 text-center font-semibold">{scoreText}</td>
                          <td className="px-3 py-3">{home}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-xs ${
                                statusLabel(match.matchStatus) === "진행"
                                  ? "bg-green-50 text-green-700"
                                  : statusLabel(match.matchStatus) === "종료"
                                    ? "bg-gray-100 text-gray-600"
                                    : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {match.liveScoreboard?.inningLabel || statusLabel(match.matchStatus)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {match.apiSportsGameId ? (
                              <span className="text-green-600 text-xs font-medium">연결</span>
                            ) : (
                              <span className="text-[#BFBFBF] text-xs">미연결</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <Link
                              href={`/admin/match-monitoring/${encodeURIComponent(selectedDateKey)}?matchIndex=${index}`}
                              className="text-[#E11936] text-xs font-medium hover:underline"
                            >
                              모니터링
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
