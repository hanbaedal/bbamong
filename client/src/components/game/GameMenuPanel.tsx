import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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
  compact,
}: {
  link: MenuLink;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={link.testId}
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-2 rounded-lg border border-transparent transition-colors hover:border-white/10 hover:bg-white/10 ${
        compact ? "px-2.5 py-2 text-xs sm:text-[13px]" : "px-3 py-2.5 text-[13px] sm:text-sm"
      } ${
        link.danger
          ? "text-[#E11937] hover:border-[#E11937]/30 hover:bg-[#E11937]/10"
          : "text-white"
      }`}
    >
      <span className="min-w-0 text-left leading-snug">{link.label}</span>
      {!link.danger && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/40" />}
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

  const isStoryPanel = panel === "story";
  const menuMaxHeight = isStoryPanel ? "min(420px,86vh)" : "min(360px,80vh)";

  const panelContent = (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/60"
        onClick={handleCloseAll}
        data-testid="game-menu-panel-backdrop"
        aria-hidden
      />

      {!selectedLink ? (
        <div
          className="fixed inset-0 z-[101] flex items-center justify-center p-3 sm:p-4 pointer-events-none"
          data-testid="game-menu-panel-group"
        >
          <div
            className="pointer-events-auto flex w-[min(420px,94vw)] flex-col overflow-hidden rounded-xl border border-[#333] bg-[#1A1A1A] shadow-2xl"
            style={{ maxHeight: menuMaxHeight }}
            data-testid="game-menu-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#333] px-3 py-2.5">
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              <button
                type="button"
                onClick={handleCloseAll}
                className="p-0.5 text-white/70 hover:text-white"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {isStoryPanel && (
                <section className="mb-3 rounded-lg border border-[#CDFF00]/20 bg-[#CDFF00]/5 px-3 py-2.5">
                  <h3 className="mb-1 text-xs font-semibold text-[#CDFF00]">오늘 예측</h3>
                  {statsLoading ? (
                    <p className="text-xs text-white/60">불러오는 중...</p>
                  ) : (
                    <p className="text-xs text-white">
                      참여{" "}
                      <span className="font-bold text-[#CDFF00]">{todayStats?.total ?? 0}</span>
                      회 · 성공{" "}
                      <span className="font-bold text-[#CDFF00]">{todayStats?.wins ?? 0}</span>회
                    </p>
                  )}
                </section>
              )}

              <ul className={isStoryPanel ? "flex flex-col gap-1" : "grid grid-cols-2 gap-1"}>
                {links.map((link) => (
                  <li key={link.href ?? link.testId ?? link.label}>
                    <MenuLinkButton
                      link={link}
                      compact={!isStoryPanel}
                      onSelect={() => handleSelectLink(link)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : selectedLink.href ? (
        <div
          className="fixed inset-0 z-[101] flex items-center justify-center p-3 sm:p-4 pointer-events-none"
          data-testid="game-menu-detail-panel"
        >
          <div
            className="pointer-events-auto flex h-[min(440px,88vh)] w-[min(520px,96vw)] flex-col overflow-hidden rounded-xl border border-[#333] bg-[#111111] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5 border-b border-[#333] px-3 py-2.5">
              <button
                type="button"
                onClick={handleBack}
                className="p-0.5 text-white/70 hover:text-white"
                aria-label="뒤로"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="flex-1 truncate text-sm font-semibold text-white">
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

  if (typeof document === "undefined") return null;

  return createPortal(panelContent, document.body);
}
