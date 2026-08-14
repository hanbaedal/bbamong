import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import AdminLayout from "./adminLayout";
import AdminPageShell from "./components/AdminPageShell";
import { adminTableClass, adminTableWrapClass } from "./components/adminPageStyles";
import { queryClient, apiRequest } from "@/lib/adminQueryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TodayLineupApplyResult, TodayLineupGame, TodayLineupSide } from "@shared/todayStartingLineup";
import { cn } from "@/lib/utils";

function kstTodayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function gameStatusLabel(status: string): string {
  const map: Record<string, string> = {
    READY: "예정",
    BEFORE: "예정",
    PLAY: "진행",
    RESULT: "종료",
    CANCEL: "취소",
    SUSPEND: "중단",
  };
  return map[status] ?? status ?? "";
}

function sourceLabel(source: TodayLineupSide["source"]): string {
  if (source === "boxscore") return "타자기록";
  if (source === "preview") return "프리뷰";
  return "없음";
}

function rosterLabel(status: string): string {
  if (status === "matched") return "선수단";
  if (status === "ambiguous") return "동명이인";
  return "미매칭";
}

export default function TodayStartingLineupPage() {
  const { toast } = useToast();
  const [date, setDate] = useState(kstTodayKey);

  const queryKey = ["/api/admin/today-lineups", date] as const;
  const { data, isLoading, isFetching, error } = useQuery<{ date: string; games: TodayLineupGame[] }>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/today-lineups?date=${encodeURIComponent(date)}`);
      return res.json();
    },
  });

  const games = data?.games ?? [];
  const applyableCount = useMemo(
    () =>
      games.filter(
        (game) =>
          game.ppamongMatchId && (game.home.batters.length > 0 || game.away.batters.length > 0),
      ).length,
    [games],
  );

  const applyMutation = useMutation({
    mutationFn: async (payload: { matchId?: string; daumGameId?: number }) => {
      const res = await apiRequest("POST", "/api/admin/today-lineups/apply", {
        date,
        ...payload,
      });
      return res.json() as Promise<{
        message: string;
        results: TodayLineupApplyResult[];
      }>;
    },
    onSuccess: (result) => {
      toast({ description: result.message });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/today-lineups"] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", description: err.message });
    },
  });

  return (
    <AdminLayout>
      <AdminPageShell
        title="오늘의 선발명단"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              className="h-9 w-[10.5rem]"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="input-today-lineup-date"
            />
            <Button
              type="button"
              variant="outline"
              disabled={isFetching}
              onClick={() => void queryClient.invalidateQueries({ queryKey })}
              data-testid="button-today-lineup-refresh"
            >
              {isFetching ? "불러오는 중…" : "다시 불러오기"}
            </Button>
            <Button
              type="button"
              disabled={applyMutation.isPending || applyableCount === 0}
              onClick={() => applyMutation.mutate({})}
              data-testid="button-today-lineup-apply-all"
            >
              {applyMutation.isPending ? "적용 중…" : `운영자 타순에 적용 (${applyableCount})`}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[#888] mb-3">
          다음 스포츠 타자기록(1~9번)을 가져와 운영자 타순에 넣습니다. 대타·정정은 운영자 화면에서 합니다.
          선발 발표 전에는 비어 있을 수 있습니다.
        </p>
        {error ? (
          <p className="text-sm text-[#E11936]">{(error as Error).message}</p>
        ) : isLoading ? (
          <p className="text-sm text-[#888]">불러오는 중…</p>
        ) : games.length === 0 ? (
          <p className="text-sm text-[#888]">해당 날짜의 KBO 경기가 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {games.map((game) => (
              <GameCard
                key={game.daumGameId}
                game={game}
                applying={applyMutation.isPending}
                onApply={() =>
                  applyMutation.mutate(
                    game.ppamongMatchId
                      ? { matchId: game.ppamongMatchId }
                      : { daumGameId: game.daumGameId },
                  )
                }
              />
            ))}
          </div>
        )}
      </AdminPageShell>
    </AdminLayout>
  );
}

function GameCard({
  game,
  applying,
  onApply,
}: {
  game: TodayLineupGame;
  applying: boolean;
  onApply: () => void;
}) {
  const canApply =
    Boolean(game.ppamongMatchId) && (game.home.batters.length > 0 || game.away.batters.length > 0);

  return (
    <section className="border border-[#E9E9E9] rounded-lg p-3" data-testid={`card-today-lineup-${game.daumGameId}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base font-semibold text-[#201E22]">
            {game.away.teamShort} @ {game.home.teamShort}
            <span className="ml-2 text-sm font-normal text-[#888]">
              {game.startTime} · {gameStatusLabel(game.gameStatus)}
            </span>
          </h2>
          <p className="text-xs text-[#888] mt-0.5">
            {game.ppamongMatchId
              ? `빠몽 ${game.registrationOrder != null ? `${game.registrationOrder}번 ` : ""}${game.ppamongMatchName ?? game.ppamongMatchId}${game.alreadyApplied ? " · 이미 적용됨" : ""}`
              : "빠몽 경기 없음"}
            {game.fetchError ? ` · ${game.fetchError}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild>
            <a href={game.gameUrl} target="_blank" rel="noreferrer">
              다음 경기
            </a>
          </Button>
          <Button
            type="button"
            disabled={!canApply || applying}
            onClick={onApply}
            data-testid={`button-apply-lineup-${game.daumGameId}`}
          >
            이 경기 적용
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <SideTable sideLabel="원정" side={game.away} />
        <SideTable sideLabel="홈" side={game.home} />
      </div>
    </section>
  );
}

function SideTable({ sideLabel, side }: { sideLabel: string; side: TodayLineupSide }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-1">
        {sideLabel} {side.teamShort}
        <span className="ml-2 text-xs font-normal text-[#888]">{sourceLabel(side.source)}</span>
      </p>
      <div className={adminTableWrapClass}>
        <table className={cn(adminTableClass, "min-w-0")}>
          <thead className="bg-[#FAFAFA] text-left text-xs text-[#666]">
            <tr>
              <th className="px-3 py-2 w-10">순</th>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2">포지션</th>
              <th className="px-3 py-2">타율</th>
              <th className="px-3 py-2">선수단</th>
            </tr>
          </thead>
          <tbody>
            {side.batters.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-[#888]">
                  선발 타순이 아직 없습니다.
                </td>
              </tr>
            ) : (
              side.batters.map((batter) => (
                <tr key={`${side.teamShort}-${batter.battingOrder}-${batter.name}`} className="border-t border-[#F0F0F0]">
                  <td className="px-3 py-2 tabular-nums">{batter.battingOrder}</td>
                  <td className="px-3 py-2 font-medium">{batter.name}</td>
                  <td className="px-3 py-2">{batter.position}</td>
                  <td className="px-3 py-2 tabular-nums">{batter.battingAverage || "—"}</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-xs",
                      batter.rosterMatch === "matched"
                        ? "text-[#1A6DFF]"
                        : batter.rosterMatch === "ambiguous"
                          ? "text-[#C2410C]"
                          : "text-[#E11936]",
                    )}
                  >
                    {rosterLabel(batter.rosterMatch)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
