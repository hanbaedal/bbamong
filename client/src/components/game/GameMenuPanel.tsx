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

const PANEL_ANCHOR =
  "fixed left-[58px] top-2 bottom-2 z-[101] flex gap-1.5 pointer-events-none sm:left-[62px] sm:top-2.5 sm:bottom-2.5";

function MenuLinkButton({
  link,
  onSelect,
  active,
}: {
  link: MenuLink;
  onSelect: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={link.testId}
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ${
        active
          ? "border-[#CDFF00]/40 bg-[#CDFF00]/10 text-white"
          : link.danger
            ? "border-transparent text-[#E11937] hover:border-[#E11937]/30 hover:bg-[#E11937]/10"
            : "border-transparent text-white hover:border-white/10 hover:bg-white/10"
      }`}
    >
      <span className="min-w-0 text-left leading-snug">{link.label}</span>
      {!link.danger && <ChevronRight className="h-3 w-3 shrink-0 text-white/40" />}
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
  const isStoryPanel = panel === "story";

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

  const panelContent = (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/50"
        onClick={handleCloseAll}
        data-testid="game-menu-panel-backdrop"
        aria-hidden
      />

      <div
        className={`${PANEL_ANCHOR} ${selectedLink ? "right-2 sm:right-2.5" : "w-[200px]"}`}
        data-testid="game-menu-panel-group"
      >
        <div
          className="pointer-events-auto flex w-[200px] shrink-0 flex-col overflow-hidden rounded-lg border border-[#333] bg-[#1A1A1A] shadow-2xl"
          data-testid="game-menu-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[#333] px-2.5 py-2">
            <h2 className="text-xs font-semibold text-white">{title}</h2>
            <button
              type="button"
              onClick={handleCloseAll}
              className="p-0.5 text-white/70 hover:text-white"
              aria-label="닫기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isStoryPanel && (
              <section className="mb-2 rounded-md border border-[#CDFF00]/20 bg-[#CDFF00]/5 px-2 py-2">
                <h3 className="mb-0.5 text-[10px] font-semibold text-[#CDFF00]">오늘 예측</h3>
                {statsLoading ? (
                  <p className="text-[10px] text-white/60">불러오는 중...</p>
                ) : (
                  <p className="text-[10px] text-white">
                    참여{" "}
                    <span className="font-bold text-[#CDFF00]">{todayStats?.total ?? 0}</span>
                    회 · 성공{" "}
                    <span className="font-bold text-[#CDFF00]">{todayStats?.wins ?? 0}</span>회
                  </p>
                )}
              </section>
            )}

            <ul className="flex flex-col gap-0.5">
              {links.map((link) => (
                <li key={link.href ?? link.testId ?? link.label}>
                  <MenuLinkButton
                    link={link}
                    active={selectedLink?.href === link.href && selectedLink?.label === link.label}
                    onSelect={() => handleSelectLink(link)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {selectedLink?.href ? (
          <div
            className="pointer-events-auto flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#333] bg-[#111111] shadow-2xl"
            data-testid="game-menu-detail-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1 border-b border-[#333] px-2.5 py-2">
              <button
                type="button"
                onClick={handleBack}
                className="p-0.5 text-white/70 hover:text-white sm:hidden"
                aria-label="뒤로"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <h3 className="min-w-0 flex-1 truncate text-xs font-semibold text-white">
                {selectedLink.label}
              </h3>
              <button
                type="button"
                onClick={handleCloseAll}
                className="p-0.5 text-white/70 hover:text-white"
                aria-label="닫기"
              >
                <X className="h-3.5 w-3.5" />
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
        ) : null}
      </div>
    </>
  );

  if (typeof document === "undefined") return null;

  return createPortal(panelContent, document.body);
}
