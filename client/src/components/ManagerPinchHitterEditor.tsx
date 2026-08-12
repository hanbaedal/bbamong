import { useState } from "react";
import { managerFetch } from "@/lib/managerQueryClient";
import { useToast } from "@/hooks/use-toast";

interface ManagerPinchHitterEditorProps {
  matchId: string;
  seasonYear: number;
  batterOrderLabel?: string;
  onClose: () => void;
  onSaved: () => void;
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

export default function ManagerPinchHitterEditor({
  matchId,
  seasonYear,
  batterOrderLabel,
  onClose,
  onSaved,
}: ManagerPinchHitterEditorProps) {
  const { toast } = useToast();
  const [playerName, setPlayerName] = useState("");
  const [battingAverage, setBattingAverage] = useState("");
  const [hits, setHits] = useState("");
  const [homeRuns, setHomeRuns] = useState("");
  const [rbi, setRbi] = useState("");
  const [ops, setOps] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!playerName.trim()) {
      toast({ variant: "destructive", description: "대타 이름을 입력하세요." });
      return;
    }
    setSaving(true);
    try {
      const res = await managerFetch(`/api/manager/matches/${matchId}/pinch-hitter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: playerName.trim(),
          battingAverage: battingAverage.trim() || null,
          hits: parseOptionalInt(hits),
          homeRuns: parseOptionalInt(homeRuns),
          rbi: parseOptionalInt(rbi),
          ops: ops.trim() || null,
          season: seasonYear,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err?.error === "string" ? err.error : "대타 저장에 실패했습니다.");
      }
      toast({ description: `대타 ${playerName.trim()}을(를) 설정했습니다.` });
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

  const fieldClass =
    "w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-[#1A6DFF] focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-3"
      data-testid="manager-pinch-hitter-editor"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">대타 입력</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {batterOrderLabel ? `${batterOrderLabel} · ` : ""}
              예측 화면에 대타 안내와 {seasonYear} 전적이 표시됩니다.
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

        <div className="space-y-3 px-4 py-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">대타 이름</span>
            <input
              className={fieldClass}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="선수 이름"
              maxLength={40}
              data-testid="input-pinch-name"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">{seasonYear} 타율</span>
            <input
              className={fieldClass}
              value={battingAverage}
              onChange={(e) => setBattingAverage(e.target.value)}
              placeholder=".285"
              data-testid="input-pinch-avg"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">안타</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                value={hits}
                onChange={(e) => setHits(e.target.value)}
                data-testid="input-pinch-hits"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">홈런</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                value={homeRuns}
                onChange={(e) => setHomeRuns(e.target.value)}
                data-testid="input-pinch-hr"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">타점</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                value={rbi}
                onChange={(e) => setRbi(e.target.value)}
                data-testid="input-pinch-rbi"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">OPS</span>
            <input
              className={fieldClass}
              value={ops}
              onChange={(e) => setOps(e.target.value)}
              placeholder=".812"
              data-testid="input-pinch-ops"
            />
          </label>
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
            disabled={saving}
            className="flex-1 rounded-lg bg-[#1A6DFF] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            data-testid="button-pinch-save"
          >
            {saving ? "저장 중..." : "대타 적용"}
          </button>
        </div>
      </div>
    </div>
  );
}
