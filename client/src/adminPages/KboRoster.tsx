import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import AdminLayout from "./adminLayout";
import AdminPageShell from "./components/AdminPageShell";
import { adminTableClass, adminTableWrapClass } from "./components/adminPageStyles";
import { queryClient, apiRequest } from "@/lib/adminQueryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KBO_TEAM_SHORT_LIST } from "@shared/kboHomeStadium";
import { KBO_BATTER_POSITIONS, type KboRosterPlayer } from "@shared/kboRoster";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  position: string;
  jerseyNumber: string;
  batsThrows: string;
  battingAverage: string;
  hits: string;
  homeRuns: string;
  rbi: string;
  ops: string;
  note: string;
  active: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  position: "내야수",
  jerseyNumber: "",
  batsThrows: "",
  battingAverage: "",
  hits: "",
  homeRuns: "",
  rbi: "",
  ops: "",
  note: "",
  active: true,
});

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function playerToForm(player: KboRosterPlayer): FormState {
  return {
    name: player.name,
    position: player.position || "내야수",
    jerseyNumber: player.jerseyNumber ?? "",
    batsThrows: player.batsThrows ?? "",
    battingAverage: player.battingAverage ?? "",
    hits: player.hits != null ? String(player.hits) : "",
    homeRuns: player.homeRuns != null ? String(player.homeRuns) : "",
    rbi: player.rbi != null ? String(player.rbi) : "",
    ops: player.ops ?? "",
    note: player.note ?? "",
    active: player.active,
  };
}

export default function KboRosterPage() {
  const { toast } = useToast();
  const [team, setTeam] = useState(KBO_TEAM_SHORT_LIST[0] ?? "두산");
  const [season, setSeason] = useState(new Date().getFullYear());
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const queryKey = ["/api/admin/kbo-players", team, season] as const;
  const { data, isLoading } = useQuery<{ players: KboRosterPlayer[] }>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/kbo-players?team=${encodeURIComponent(team)}&season=${season}`,
      );
      return res.json();
    },
  });

  const players = data?.players ?? [];

  const importMutation = useMutation({
    mutationFn: async (scope: "team" | "all") => {
      const res = await apiRequest("POST", "/api/admin/kbo-players/import-kbo-register", {
        scope,
        team,
        season,
      });
      return res.json() as Promise<{
        message: string;
        season: number;
        teams: Array<{
          team: string;
          created: number;
          updated: number;
          deactivated: number;
          fetched: number;
          error?: string;
        }>;
      }>;
    },
    onSuccess: (result) => {
      const created = result.teams.reduce((sum, row) => sum + row.created, 0);
      const updated = result.teams.reduce((sum, row) => sum + row.updated, 0);
      const deactivated = result.teams.reduce((sum, row) => sum + row.deactivated, 0);
      const errors = result.teams.filter((row) => row.error);
      const summary = `${result.season}시즌 ${created}명 추가, ${updated}명 갱신`;
      const extra = deactivated ? `, ${deactivated}명 말소` : "";
      toast({
        variant: errors.length ? "destructive" : "default",
        description: errors.length
          ? `${summary}${extra}. 일부 팀 실패: ${errors.map((row) => row.team).join(", ")}`
          : `${summary}${extra}`,
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/kbo-players"] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", description: error.message });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        team,
        season,
        name: form.name.trim(),
        position: form.position,
        jerseyNumber: form.jerseyNumber.trim(),
        batsThrows: form.batsThrows.trim(),
        battingAverage: form.battingAverage.trim() || null,
        hits: parseOptionalInt(form.hits),
        homeRuns: parseOptionalInt(form.homeRuns),
        rbi: parseOptionalInt(form.rbi),
        ops: form.ops.trim() || null,
        note: form.note.trim(),
        active: form.active,
      };
      if (editingId) {
        await apiRequest("PUT", `/api/admin/kbo-players/${editingId}`, payload);
      } else {
        await apiRequest("POST", "/api/admin/kbo-players", payload);
      }
    },
    onSuccess: () => {
      toast({ description: editingId ? "선수 정보를 수정했습니다." : "선수를 등록했습니다." });
      setForm(emptyForm());
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/kbo-players/${id}`);
    },
    onSuccess: () => {
      toast({ description: "선수를 삭제했습니다." });
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", description: error.message });
    },
  });

  const fieldClass = "h-9 text-sm";
  const activeCount = useMemo(
    () => players.filter((p) => p.active).length,
    [players],
  );

  return (
    <AdminLayout>
      <AdminPageShell title="KBO 선수단">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {KBO_TEAM_SHORT_LIST.map((short) => (
            <button
              key={short}
              type="button"
              onClick={() => {
                setTeam(short);
                setEditingId(null);
                setForm(emptyForm());
              }}
              className={cn(
                "h-8 px-3 rounded-full text-sm font-semibold border",
                team === short
                  ? "bg-[#1A6DFF] text-white border-[#1A6DFF]"
                  : "bg-white text-[#201E22] border-[#E9E9E9]",
              )}
              data-testid={`button-kbo-team-${short}`}
            >
              {short}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="block">
            <span className="block text-xs text-[#666] mb-1">시즌</span>
            <Input
              type="number"
              className="w-24 h-9"
              value={season}
              onChange={(e) => setSeason(Number.parseInt(e.target.value, 10) || season)}
              data-testid="input-kbo-season"
            />
          </label>
          <p className="text-xs text-[#888] pb-2">
            {team} {season} · {activeCount}명 활성 / {players.length}명
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={importMutation.isPending}
            onClick={() => importMutation.mutate("team")}
            data-testid="button-import-kbo-team"
          >
            {importMutation.isPending ? "불러오는 중…" : "이 팀 1군 불러오기"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={importMutation.isPending}
            onClick={() => importMutation.mutate("all")}
            data-testid="button-import-kbo-all"
          >
            10구단 모두 불러오기
          </Button>
        </div>

        <form
          className="rounded-lg border border-[#E9E9E9] p-3 mb-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void saveMutation.mutate();
          }}
        >
          <label className="block col-span-2">
            <span className="block text-xs text-[#666] mb-1">이름</span>
            <Input
              className={fieldClass}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
              data-testid="input-kbo-player-name"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-[#666] mb-1">포지션</span>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={form.position}
              onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
              data-testid="select-kbo-player-position"
            >
              {KBO_BATTER_POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-[#666] mb-1">등번호</span>
            <Input
              className={fieldClass}
              value={form.jerseyNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, jerseyNumber: e.target.value }))}
              maxLength={4}
              data-testid="input-kbo-player-jersey"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-[#666] mb-1">투타유형</span>
            <Input
              className={fieldClass}
              value={form.batsThrows}
              onChange={(e) => setForm((prev) => ({ ...prev, batsThrows: e.target.value }))}
              placeholder="우투우타"
              maxLength={20}
              data-testid="input-kbo-player-bats-throws"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-[#666] mb-1">시즌타율</span>
            <Input
              className={fieldClass}
              value={form.battingAverage}
              onChange={(e) => setForm((prev) => ({ ...prev, battingAverage: e.target.value }))}
              placeholder=".285"
              data-testid="input-kbo-player-avg"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-[#666] mb-1">안타</span>
            <Input
              className={fieldClass}
              inputMode="numeric"
              value={form.hits}
              onChange={(e) => setForm((prev) => ({ ...prev, hits: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-[#666] mb-1">홈런</span>
            <Input
              className={fieldClass}
              inputMode="numeric"
              value={form.homeRuns}
              onChange={(e) => setForm((prev) => ({ ...prev, homeRuns: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-[#666] mb-1">타점</span>
            <Input
              className={fieldClass}
              inputMode="numeric"
              value={form.rbi}
              onChange={(e) => setForm((prev) => ({ ...prev, rbi: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-[#666] mb-1">OPS</span>
            <Input
              className={fieldClass}
              value={form.ops}
              onChange={(e) => setForm((prev) => ({ ...prev, ops: e.target.value }))}
              placeholder=".812"
            />
          </label>
          <label className="block col-span-2 md:col-span-3 xl:col-span-5">
            <span className="block text-xs text-[#666] mb-1">특징</span>
            <Input
              className={fieldClass}
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              maxLength={80}
            />
          </label>
          <label className="flex items-center gap-2 h-9 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
            />
            활성
          </label>
          <div className="flex gap-2 col-span-2 md:col-span-4 xl:col-span-2">
            {editingId ? (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm());
                }}
              >
                취소
              </Button>
            ) : null}
            <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "저장 중…" : editingId ? "수정" : "등록"}
            </Button>
          </div>
        </form>

        <div className={adminTableWrapClass}>
          <table className={adminTableClass}>
            <thead className="bg-[#FAFAFA] text-left text-xs text-[#666]">
              <tr>
                <th className="px-3 py-2">등번호</th>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">포지션</th>
                <th className="px-3 py-2">투타</th>
                <th className="px-3 py-2">타율</th>
                <th className="px-3 py-2">안타</th>
                <th className="px-3 py-2">홈런</th>
                <th className="px-3 py-2">타점</th>
                <th className="px-3 py-2">OPS</th>
                <th className="px-3 py-2">특징</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2 w-32" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-sm text-[#888]">
                    불러오는 중…
                  </td>
                </tr>
              ) : players.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-sm text-[#888]">
                    {team} {season} 등록된 선수가 없습니다.
                  </td>
                </tr>
              ) : (
                players.map((player) => (
                  <tr key={player.id} className="border-t border-[#F0F0F0]">
                    <td className="px-3 py-2 tabular-nums">{player.jerseyNumber || "—"}</td>
                    <td className="px-3 py-2 font-medium">{player.name}</td>
                    <td className="px-3 py-2">{player.position}</td>
                    <td className="px-3 py-2">{player.batsThrows || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{player.battingAverage || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{player.hits ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{player.homeRuns ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{player.rbi ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{player.ops || "—"}</td>
                    <td className="px-3 py-2 max-w-[12rem] truncate" title={player.note}>
                      {player.note || "—"}
                    </td>
                    <td className="px-3 py-2">{player.active ? "활성" : "말소"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(player.id);
                            setForm(playerToForm(player));
                          }}
                        >
                          수정
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`${player.name}을(를) 삭제할까요?`)) {
                              deleteMutation.mutate(player.id);
                            }
                          }}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminPageShell>
    </AdminLayout>
  );
}
