import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/adminQueryClient";
import AdminLayout from "../adminLayout";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Stadium {
  id: number;
  name: string;
  createdAt: string;
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
  const { user } = useUser();
  const { assets } = useAdminAssets();
  const isSuperAdmin = user?.userType === "슈퍼어드민";

  const searchParams = new URLSearchParams(window.location.search);
  const tabFromUrl = searchParams.get("tab") as "stadiums" | "matches" | null;
  const [activeTab, setActiveTab] = useState<"stadiums" | "matches">(tabFromUrl || "matches");

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | undefined>();
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [syncingDate, setSyncingDate] = useState<string | null>(null);
  const [lastSyncMeta, setLastSyncMeta] = useState<{
    date: string;
    created: number;
    updated: number;
    linked: number;
  } | null>(null);

  const [showAddStadiumModal, setShowAddStadiumModal] = useState(false);
  const [stadiumName, setStadiumName] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteForceConfirmOpen, setDeleteForceConfirmOpen] = useState(false);
  const [deleteForceMessage, setDeleteForceMessage] = useState("");
  const [selectedStadium, setSelectedStadium] = useState<Stadium | null>(null);

  const { data: stadiums, isLoading: stadiumsLoading } = useQuery<Stadium[]>({
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

  const syncDate = async (dateKey: string, silentEmpty = false) => {
    setSyncingDate(dateKey);
    try {
      const res = await apiRequest("POST", "/api/admin/matches/sync-from-api-sports", {
        date: dateKey,
      });
      const body = await res.json();
      const created = body.created ?? 0;
      const updated = body.updated ?? 0;
      const linked = body.linked ?? 0;
      setLastSyncMeta({ date: dateKey, created, updated, linked });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/stadiums"] });

      if (linked === 0) {
        if (!silentEmpty) {
          toast({
            variant: "destructive",
            description: `${dateKey} API 경기가 없습니다. (키·시즌·리그 확인)`,
          });
        }
      } else {
        toast({
          description: `${dateKey} 반영 · 신규 ${created} · 갱신 ${updated} · 연결 ${linked}`,
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

  const openDay = async (day: Date | undefined) => {
    if (!day) return;
    setSelectedDay(day);
    setDayModalOpen(true);
    const dateKey = toDateKey(day);
    // 조회 = 자동 DB 저장·API 연결
    await syncDate(dateKey, true);
  };

  const createMutation = useMutation({
    mutationFn: async (name: string) => apiRequest("POST", "/api/admin/stadiums", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stadiums"] });
      setShowAddStadiumModal(false);
      setStadiumName("");
      toast({ description: "구장이 추가되었습니다." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", description: err?.message || "구장 추가에 실패했습니다." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, force }: { id: number; force?: boolean }) => {
      const url = force ? `/api/admin/stadiums/${id}?force=true` : `/api/admin/stadiums/${id}`;
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw { status: res.status, ...data };
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stadiums"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matches"] });
      setDeleteConfirmOpen(false);
      setDeleteForceConfirmOpen(false);
      toast({ description: "구장이 삭제되었습니다." });
    },
    onError: (err: any) => {
      if (err?.status === 409 && err?.requireConfirm) {
        setDeleteConfirmOpen(false);
        setDeleteForceMessage(err.message);
        setDeleteForceConfirmOpen(true);
        return;
      }
      setDeleteConfirmOpen(false);
      setDeleteForceConfirmOpen(false);
      toast({ variant: "destructive", description: err?.message || "구장 삭제에 실패했습니다." });
    },
  });

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  }

  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-6" data-testid="breadcrumb">
        <span className="text-sm text-[#BFBFBF]">경기 관리</span>
      </div>
      <h1
        className="text-2xl font-semibold text-[#201E22] mb-6 flex items-center gap-2"
        data-testid="text-page-title"
      >
        <img src={assets.adListIcon} className="w-8 h-8" alt="" /> 경기 관리
      </h1>

      <div className="flex justify-between mb-6 border-b border-[#E9E9E9]">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("matches")}
            className={`pb-3 px-11 text-base font-medium ${
              activeTab === "matches"
                ? "border-b-2 border-[#E11936] text-[#E11936]"
                : "text-[#BFBFBF]"
            }`}
            data-testid="tab-matches"
          >
            경기
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stadiums")}
            className={`pb-3 px-8 text-base font-medium ${
              activeTab === "stadiums"
                ? "border-b-2 border-[#E11936] text-[#E11936]"
                : "text-[#BFBFBF]"
            }`}
            data-testid="tab-stadiums"
          >
            경기 구장
          </button>
        </div>
        {activeTab === "stadiums" && (
          <button
            type="button"
            onClick={() => setShowAddStadiumModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 h-[40px] bg-[#E11936] text-white rounded font-medium text-sm mb-3"
            data-testid="button-add-stadium"
          >
            + 구장 추가
          </button>
        )}
      </div>

      {activeTab === "matches" && (
        <div className="space-y-4">
          <p className="text-sm text-[#666] leading-relaxed">
            달력에서 <strong className="text-[#201E22]">날짜를 클릭</strong>하면 그날 KBO 일정을
            API에서 읽어 <strong className="text-[#201E22]">DB에 자동 저장·연결</strong>합니다.
            (하루 최대 5경기 · 별도 등록 버튼 불필요)
          </p>

          <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-6 items-start">
            <div className="border border-[#E9E9E9] rounded-[12px] bg-white p-4 inline-block">
              {matchesLoading ? (
                <div className="w-[280px] h-[300px] animate-pulse bg-[#F3F3F3] rounded-lg" />
              ) : (
                <Calendar
                  mode="single"
                  locale={ko}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  selected={selectedDay}
                  onSelect={(day) => void openDay(day)}
                  modifiers={{
                    hasMatch: (date) => datesWithMatches.has(toDateKey(date)),
                  }}
                  modifiersClassNames={{
                    hasMatch: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-[#E11936]",
                  }}
                  className="rounded-md"
                />
              )}
            </div>

            <div className="border border-[#E9E9E9] rounded-[12px] bg-[#F9F9F9] p-5 min-h-[200px]">
              <h2 className="text-base font-semibold text-[#201E22] mb-2">이용 안내</h2>
              <ul className="text-sm text-[#666] space-y-2 list-disc pl-5">
                <li>빨간 점이 있는 날짜는 이미 DB에 경기가 있습니다.</li>
                <li>날짜를 열면 API 조회와 동시에 저장·연결됩니다.</li>
                <li>모달 표에서 모니터링 화면으로 이동할 수 있습니다.</li>
                <li>사용자 앱에는 구단명 대신 홈팀/원정팀만 표시됩니다.</li>
              </ul>
              <button
                type="button"
                className="mt-4 px-4 py-2 text-sm rounded-md bg-[#201E22] text-white disabled:opacity-50"
                disabled={Boolean(syncingDate)}
                onClick={() => void openDay(new Date())}
                data-testid="button-open-today"
              >
                {syncingDate ? "불러오는 중..." : "오늘 날짜 열기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "stadiums" && (
        <>
          <div className="grid grid-cols-[30%_50%_20%] px-4 py-3 bg-[#F9F9F9] text-sm font-medium text-[#4D4B4E] mb-2">
            <div>등록일</div>
            <div>구장명</div>
            <div>관리</div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {stadiumsLoading ? (
              <div className="py-16 text-center text-[#BFBFBF] text-sm">불러오는 중...</div>
            ) : !stadiums?.length ? (
              <div className="py-16 text-center text-[#BFBFBF] text-sm">등록된 구장이 없습니다.</div>
            ) : (
              stadiums.map((stadium) => (
                <div
                  key={stadium.id}
                  className="grid grid-cols-[30%_50%_20%] px-4 py-5 bg-white border-b border-[#E9E9E9] items-center h-16"
                >
                  <div>{formatDate(stadium.createdAt)}</div>
                  <div className="truncate">{stadium.name}</div>
                  <div>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStadium(stadium);
                          setDeleteConfirmOpen(true);
                        }}
                        className="px-3 py-1 text-xs font-medium text-[#E11936] border border-[#E11936] rounded"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* 날짜 경기 모달 */}
      {dayModalOpen && selectedDay && selectedDateKey && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setDayModalOpen(false)}
          data-testid="modal-day-matches"
        >
          <div
            className="bg-white rounded-[12px] w-full max-w-[820px] max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9E9E9]">
              <div>
                <h2 className="text-lg font-semibold text-[#201E22]">
                  {format(selectedDay, "yyyy년 M월 d일 (EEE)", { locale: ko })} 경기
                </h2>
                <p className="text-xs text-[#888] mt-1">
                  {syncingDate === selectedDateKey
                    ? "API에서 일정을 불러와 DB에 저장 중..."
                    : lastSyncMeta?.date === selectedDateKey
                      ? `자동 반영됨 · 신규 ${lastSyncMeta.created} · 갱신 ${lastSyncMeta.updated} · 연결 ${lastSyncMeta.linked}`
                      : "날짜를 열면 API 일정이 자동 저장·연결됩니다."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={syncingDate === selectedDateKey}
                  onClick={() => void syncDate(selectedDateKey)}
                  className="px-3 py-1.5 text-xs rounded-md border border-[#E9E9E9] hover:border-[#E11936] hover:text-[#E11936] disabled:opacity-50"
                  data-testid="button-force-resync"
                >
                  {syncingDate === selectedDateKey ? "동기화 중..." : "다시 동기화"}
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

      {showAddStadiumModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
          onClick={() => setShowAddStadiumModal(false)}
        >
          <div
            className="bg-white rounded-[10px] px-6 py-5 w-[420px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">경기구장 추가</h2>
              <button type="button" onClick={() => setShowAddStadiumModal(false)}>
                ✕
              </button>
            </div>
            <label className="text-sm text-[#4D4B4E]">구장명</label>
            <input
              type="text"
              value={stadiumName}
              onChange={(e) => setStadiumName(e.target.value)}
              className="w-full mt-2 mb-6 border-b border-[#373539] py-3 outline-none"
              placeholder="구장 명을 입력해 주세요"
            />
            <button
              type="button"
              disabled={!stadiumName.trim()}
              onClick={() => createMutation.mutate(stadiumName)}
              className="w-full h-12 bg-[#111] text-white rounded-lg disabled:opacity-50"
            >
              추가하기
            </button>
          </div>
        </div>
      )}

      {deleteConfirmOpen && selectedStadium && (
        <SimpleConfirmPopup
          message={`${selectedStadium.name} 구장을 삭제하시겠습니까?`}
          leftButtonText="취소"
          rightButtonText="삭제하기"
          onLeftClick={() => setDeleteConfirmOpen(false)}
          onRightClick={() =>
            deleteMutation.mutate({ id: selectedStadium.id })
          }
        />
      )}

      {deleteForceConfirmOpen && selectedStadium && (
        <SimpleConfirmPopup
          message={`${deleteForceMessage} 정말 삭제하시겠습니까?`}
          leftButtonText="취소"
          rightButtonText="삭제하기"
          onLeftClick={() => setDeleteForceConfirmOpen(false)}
          onRightClick={() =>
            deleteMutation.mutate({ id: selectedStadium.id, force: true })
          }
        />
      )}
    </AdminLayout>
  );
}
