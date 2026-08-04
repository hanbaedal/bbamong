import { useEffect, useRef, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import type { GameMenuAction } from "./GameLeftMenu";
import {
  buildGameEmbedUrl,
  GAME_EMBED_MESSAGE,
  isGameEmbedMessage,
} from "@/lib/gameEmbed";

export interface MenuLink {
  label: string;
  href?: string;
  action?: "withdraw";
  testId?: string;
  danger?: boolean;
}

interface GameMenuPanelProps {
  panel: GameMenuAction | null;
  onClose: () => void;
  storyLinks: MenuLink[];
  infoLinks: MenuLink[];
  todayStats?: { total: number; wins: number };
  statsLoading?: boolean;
  onMenuAction?: (action: "withdraw") => void;
}

function MenuLinkButton({
  link,
  onSelect,
}: {
  link: MenuLink;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={link.testId}
      onClick={onSelect}
      className={`flex w-full items-center rounded-lg border border-transparent px-2.5 py-2 text-left text-xs transition-colors sm:text-[13px] ${
        link.danger
          ? "text-[#E11937] hover:border-[#E11937]/30 hover:bg-[#E11937]/10"
          : "text-white hover:border-white/10 hover:bg-white/10"
      }`}
    >
      {link.label}
    </button>
  );
}

export default function GameMenuPanel({
  panel,
  onClose,
  storyLinks,
  infoLinks,
  todayStats,
  statsLoading,
  onMenuAction,
}: GameMenuPanelProps) {
  const [selectedLink, setSelectedLink] = useState<MenuLink | null>(null);
  const selectedLinkRef = useRef<MenuLink | null>(null);

  useEffect(() => {
    selectedLinkRef.current = selectedLink;
  }, [selectedLink]);

  useEffect(() => {
    setSelectedLink(null);
  }, [panel]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isGameEmbedMessage(event.data)) return;

      if (event.data.type === GAME_EMBED_MESSAGE.CLOSE) {
        setSelectedLink(null);
        onClose();
        return;
      }

      if (event.data.type === GAME_EMBED_MESSAGE.BACK) {
        if (selectedLinkRef.current) {
          setSelectedLink(null);
        } else {
          onClose();
        }
        return;
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onClose]);

  if (!panel) return null;

  const links = panel === "story" ? storyLinks : infoLinks;
  const title = panel === "story" ? "내 이야기" : "내 정보";

  const handleCloseAll = () => {
    setSelectedLink(null);
    onClose();
  };

  const handleBack = () => {
    if (selectedLink) {
      setSelectedLink(null);
      return;
    }
    handleCloseAll();
  };

  const handleSelectLink = (link: MenuLink) => {
    if (link.action === "withdraw") {
      onMenuAction?.("withdraw");
      return;
    }
    if (link.href) {
      setSelectedLink(link);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/55"
        onClick={handleCloseAll}
        data-testid="game-menu-panel-backdrop"
        aria-hidden
      />

      {!selectedLink ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => e.stopPropagation()}
          data-testid="game-menu-panel-group"
        >
          <div
            className="flex w-[min(400px,92vw)] max-h-[min(340px,80vh)] flex-col overflow-hidden rounded-xl border border-[#333] bg-[#1A1A1A] shadow-2xl"
            data-testid="game-menu-panel"
          >
            <div className="flex items-center justify-between border-b border-[#333] px-3 py-2">
              <h2 className="text-[13px] font-semibold text-white sm:text-sm">{title}</h2>
              <button
                type="button"
                onClick={handleCloseAll}
                className="p-0.5 text-white/70 hover:text-white"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 sm:p-3">
              {panel === "story" && (
                <section className="mb-2.5 rounded-lg border border-[#CDFF00]/20 bg-[#CDFF00]/5 px-2.5 py-2">
                  <h3 className="mb-0.5 text-[11px] font-semibold text-[#CDFF00] sm:text-xs">
                    오늘 예측
                  </h3>
                  {statsLoading ? (
                    <p className="text-[11px] text-white/60 sm:text-xs">불러오는 중...</p>
                  ) : (
                    <p className="text-[11px] text-white sm:text-xs">
                      참여{" "}
                      <span className="font-bold text-[#CDFF00]">{todayStats?.total ?? 0}</span>
                      회 · 성공{" "}
                      <span className="font-bold text-[#CDFF00]">{todayStats?.wins ?? 0}</span>회
                    </p>
                  )}
                </section>
              )}

              <ul className="grid grid-cols-2 gap-1">
                {links.map((link) => (
                  <li key={link.href ?? link.testId ?? link.label}>
                    <MenuLinkButton link={link} onSelect={() => handleSelectLink(link)} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : selectedLink.href ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => e.stopPropagation()}
          data-testid="game-menu-detail-panel"
        >
          <div className="flex h-[min(400px,82vh)] w-[min(480px,94vw)] flex-col overflow-hidden rounded-xl border border-[#333] bg-[#111111] shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-[#333] px-2.5 py-2">
              <button
                type="button"
                onClick={handleBack}
                className="p-0.5 text-white/70 hover:text-white"
                aria-label="뒤로"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="flex-1 truncate text-[13px] font-semibold text-white sm:text-sm">
                {selectedLink.label}
              </h3>
              <button
                type="button"
                onClick={handleCloseAll}
                className="p-0.5 text-white/70 hover:text-white"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <iframe
              key={selectedLink.href}
              src={buildGameEmbedUrl(selectedLink.href)}
              title={selectedLink.label}
              className="min-h-0 w-full flex-1 border-0 bg-[#111111]"
              data-testid="game-menu-detail-frame"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
