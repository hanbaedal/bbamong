import { useEffect, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import type { GameMenuAction } from "./GameLeftMenu";
import type { SubmenuAnchor } from "./GameLeftMenu";
import { buildGameEmbedUrl } from "@/lib/gameEmbed";

export interface MenuLink {
  label: string;
  href: string;
  testId?: string;
}

interface GameMenuPanelProps {
  panel: GameMenuAction | null;
  anchor: SubmenuAnchor | null;
  onClose: () => void;
  storyLinks: MenuLink[];
  infoLinks: MenuLink[];
  todayStats?: { total: number; wins: number };
  statsLoading?: boolean;
}

function MenuLinkButton({
  link,
  selected,
  onSelect,
}: {
  link: MenuLink;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={link.testId}
      onClick={onSelect}
      className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
        selected
          ? "border border-[#CDFF00]/40 bg-[#CDFF00]/10 text-[#FFE566]"
          : "border border-transparent text-white hover:border-white/10 hover:bg-white/10"
      }`}
    >
      {link.label}
    </button>
  );
}

export default function GameMenuPanel({
  panel,
  anchor,
  onClose,
  storyLinks,
  infoLinks,
  todayStats,
  statsLoading,
}: GameMenuPanelProps) {
  const [selectedLink, setSelectedLink] = useState<MenuLink | null>(null);

  useEffect(() => {
    setSelectedLink(null);
  }, [panel]);

  if (!panel || !anchor) return null;

  const links = panel === "story" ? storyLinks : infoLinks;
  const title = panel === "story" ? "내 이야기" : "내 정보";

  const handleCloseAll = () => {
    setSelectedLink(null);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/45"
        onClick={handleCloseAll}
        data-testid="game-menu-panel-backdrop"
        aria-hidden
      />
      <div
        className="fixed z-50 flex max-h-[min(480px,82vh)] flex-row items-stretch gap-2"
        style={{
          top: anchor.top + anchor.height / 2,
          left: anchor.left,
          transform: "translateY(-50%)",
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="game-menu-panel-group"
      >
        {/* 서브메뉴 */}
        <div
          className="flex w-[min(260px,38vw)] flex-col overflow-hidden rounded-xl border border-[#333] bg-[#1A1A1A] shadow-2xl"
          data-testid="game-menu-panel"
        >
          <div className="flex items-center justify-between border-b border-[#333] px-4 py-2.5">
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <button
              type="button"
              onClick={handleCloseAll}
              className="p-1 text-white/70 hover:text-white"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {panel === "story" && (
              <section className="mb-4">
                <h3 className="mb-2 text-sm font-semibold text-[#CDFF00]">오늘 예측</h3>
                {statsLoading ? (
                  <p className="text-sm text-white/60">불러오는 중...</p>
                ) : (
                  <p className="text-sm text-white">
                    참여{" "}
                    <span className="font-bold text-[#CDFF00]">{todayStats?.total ?? 0}</span>회 ·
                    성공{" "}
                    <span className="font-bold text-[#CDFF00]">{todayStats?.wins ?? 0}</span>회
                  </p>
                )}
              </section>
            )}
            <ul className="space-y-1">
              {links.map((link) => (
                <li key={link.href}>
                  <MenuLinkButton
                    link={link}
                    selected={selectedLink?.href === link.href}
                    onSelect={() => setSelectedLink(link)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 콘텐츠 모달 — 서브메뉴 오른쪽 */}
        {selectedLink && (
          <div
            className="flex w-[min(520px,52vw)] flex-col overflow-hidden rounded-xl border border-[#333] bg-[#111111] shadow-2xl"
            data-testid="game-menu-detail-panel"
          >
            <div className="flex items-center gap-2 border-b border-[#333] px-3 py-2.5">
              <button
                type="button"
                onClick={() => setSelectedLink(null)}
                className="p-1 text-white/70 hover:text-white"
                aria-label="서브메뉴로"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="flex-1 truncate text-sm font-semibold text-white">
                {selectedLink.label}
              </h3>
              <button
                type="button"
                onClick={handleCloseAll}
                className="p-1 text-white/70 hover:text-white"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <iframe
              key={selectedLink.href}
              src={buildGameEmbedUrl(selectedLink.href)}
              title={selectedLink.label}
              className="min-h-[min(400px,72vh)] w-full flex-1 border-0 bg-[#111111]"
              data-testid="game-menu-detail-frame"
            />
          </div>
        )}
      </div>
    </>
  );
}
