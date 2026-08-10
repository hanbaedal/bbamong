import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/contexts/UserContext";

export type GameNotice = {
  id: number;
  tag: string;
  title: string;
  content: string;
  createdAt: string;
};

function getBannerLabel(tag: string): string {
  if (tag === "긴급") return "긴급";
  if (tag === "중요" || tag === "우선" || tag === "필독") return "필독";
  return "공지사항";
}

function getBannerStyles(tag: string): { pill: string; badge: string } {
  if (tag === "긴급") {
    return {
      badge: "bg-[#E11936] text-white",
      pill: "border-[#E11936]/80 bg-[#E11936]/20 text-white shadow-[0_0_12px_rgba(225,25,54,0.35)]",
    };
  }
  if (tag === "중요" || tag === "우선" || tag === "필독") {
    return {
      badge: "bg-[#FDE047] text-black",
      pill: "border-[#FDE047]/70 bg-[#FDE047]/15 text-[#FFF8DC] shadow-[0_0_10px_rgba(253,224,71,0.25)]",
    };
  }
  return {
    badge: "bg-[#373539] text-[#CDFF00]",
    pill: "border-[#CDFF00]/50 bg-black/55 text-white backdrop-blur-sm",
  };
}

function GameNoticeModal({
  notice,
  onDismiss,
  dismissing,
}: {
  notice: GameNotice;
  onDismiss: () => void;
  dismissing: boolean;
}) {
  const label = getBannerLabel(notice.tag);
  const { badge } = getBannerStyles(notice.tag);

  return (
    <>
      <div
        className="fixed inset-0 z-[102] bg-black/65"
        onClick={onDismiss}
        data-testid="game-notice-modal-backdrop"
        aria-hidden
      />
      <div
        className="fixed inset-0 z-[103] flex items-center justify-center p-4 pointer-events-none"
        data-testid="game-notice-modal"
      >
        <div
          className="pointer-events-auto flex max-h-[min(420px,88vh)] w-[min(480px,94vw)] flex-col overflow-hidden rounded-xl border border-[#444] bg-[#1A1A1A] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-2 border-b border-[#333] px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold sm:text-xs ${badge}`}>
                  {label}
                </span>
                <span className="text-[10px] text-[#888] sm:text-xs">
                  {format(new Date(notice.createdAt), "yyyy.MM.dd HH:mm")}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white leading-snug">{notice.title}</h3>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              disabled={dismissing}
              className="shrink-0 p-0.5 text-white/70 hover:text-white disabled:opacity-50"
              aria-label="닫기"
              data-testid="game-notice-modal-close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#D5D5D5] sm:text-sm">
              {notice.content}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function GameNoticeBanner({ suppressed = false }: { suppressed?: boolean }) {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery<{ notice: GameNotice | null }>({
    queryKey: ["/api/users/notices/banner"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/notices/banner");
      return res.json();
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    retry: false,
  });

  const dismissMutation = useMutation({
    mutationFn: async (noticeId: number) => {
      await apiRequest("POST", `/api/users/notices/${noticeId}/dismiss`, { kind: "game" });
    },
    onSuccess: () => {
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users/notices/banner"] });
    },
  });

  const notice = data?.notice ?? null;
  if (isLoading || !notice || suppressed) return null;

  const label = getBannerLabel(notice.tag);
  const { pill, badge } = getBannerStyles(notice.tag);

  const handleDismiss = () => {
    dismissMutation.mutate(notice.id);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`absolute top-2 left-[58px] z-[35] flex max-w-[min(280px,42vw)] items-center gap-1.5 rounded-full border px-2 py-1 pointer-events-auto transition hover:brightness-110 sm:left-[62px] sm:max-w-[min(320px,48vw)] sm:px-2.5 sm:py-1.5 ${pill}`}
        data-testid="game-notice-banner"
      >
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold sm:text-[10px] ${badge}`}>
          {label}
        </span>
        <span className="min-w-0 truncate text-left text-[10px] font-medium sm:text-xs">{notice.title}</span>
      </button>

      {modalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <GameNoticeModal
            notice={notice}
            onDismiss={handleDismiss}
            dismissing={dismissMutation.isPending}
          />,
          document.body,
        )}
    </>
  );
}
