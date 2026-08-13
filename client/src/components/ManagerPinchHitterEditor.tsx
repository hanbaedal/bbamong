import { useEffect, useState } from "react";
import { managerFetch } from "@/lib/managerQueryClient";
import { useToast } from "@/hooks/use-toast";
import type { KboRosterPlayer } from "@shared/kboRoster";
import type { LineupSide } from "@/components/ManagerLineupEditor";
import ManagerRosterPicker from "@/components/ManagerRosterPicker";

interface ManagerPinchHitterEditorProps {
  matchId: string;
  seasonYear: number;
  side: LineupSide;
  teamLabel: string;
  batterOrderLabel?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function ManagerPinchHitterEditor({
  matchId,
  seasonYear,
  side,
  teamLabel,
  batterOrderLabel,
  onClose,
  onSaved,
}: ManagerPinchHitterEditorProps) {
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(true);
  const [selected, setSelected] = useState<KboRosterPlayer | null>(null);
  const [players, setPlayers] = useState<KboRosterPlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingPlayers(true);
    void managerFetch(
      `/api/manager/matches/${matchId}/kbo-roster?side=${side}&season=${seasonYear}`,
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("선수단을 불러오지 못했습니다.");
        const data = (await res.json()) as { players?: KboRosterPlayer[] };
        if (!cancelled) setPlayers(data.players ?? []);
      })
      .catch(() => {
        if (!cancelled) setPlayers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPlayers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, side, seasonYear]);

  const handleSave = async () => {
    if (!selected) {
      toast({ variant: "destructive", description: "대타 선수를 선택하세요." });
      return;
    }
    setSaving(true);
    try {
      const res = await managerFetch(`/api/manager/matches/${matchId}/pinch-hitter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rosterPlayerId: selected.id,
          playerName: selected.name,
          season: seasonYear,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err?.error === "string" ? err.error : "대타 저장에 실패했습니다.");
      }
      toast({ description: `대타 ${selected.name}을(를) 설정했습니다.` });
      onSaved();
      onClose();
    } catch (err) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : "대타 저장에 실패했습니다.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-3"
      data-testid="manager-pinch-hitter-editor"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">대타 선택</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {batterOrderLabel ? `${batterOrderLabel} · ` : ""}
              {teamLabel} 명단에서 고릅니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
            data-testid="button-pinch-close"
          >
            닫기
          </button>
        </div>

        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full h-12 rounded-lg border border-gray-200 px-3 text-left"
            data-testid="input-pinch-name"
          >
            {selected ? (
              <span>
                <span className="font-semibold text-gray-900">{selected.name}</span>
                <span className="ml-1 text-xs text-[#1A6DFF]">{selected.position}</span>
              </span>
            ) : (
              <span className="text-gray-400">선수 선택</span>
            )}
          </button>
        </div>

        <div className="flex gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !selected}
            className="flex-1 rounded-lg bg-[#1A6DFF] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            data-testid="button-pinch-save"
          >
            {saving ? "저장 중..." : "대타 적용"}
          </button>
        </div>
      </div>

      {pickerOpen ? (
        <ManagerRosterPicker
          teamLabel={`${teamLabel} 대타`}
          players={players}
          loading={loadingPlayers}
          selectedId={selected?.id}
          onSelect={(player) => {
            setSelected(player);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
