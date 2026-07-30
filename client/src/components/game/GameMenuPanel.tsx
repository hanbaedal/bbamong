import { X } from "lucide-react";
import type { GameMenuAction } from "./GameLeftMenu";

interface MenuLink {
  label: string;
  href: string;
  testId?: string;
}

interface GameMenuPanelProps {
  panel: GameMenuAction | null;
  onClose: () => void;
  storyLinks: MenuLink[];
  infoLinks: MenuLink[];
  todayStats?: { total: number; wins: number };
  statsLoading?: boolean;
}

function PanelShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/50"
      onClick={onClose}
      data-testid="game-menu-panel-backdrop"
    >
      <div
        className="w-[min(320px,85vw)] h-full bg-[#1A1A1A] border-l border-[#333] shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
          <h2 className="text-white font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-white/70 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export default function GameMenuPanel({
  panel,
  onClose,
  storyLinks,
  infoLinks,
  todayStats,
  statsLoading,
}: GameMenuPanelProps) {
  if (panel === "story") {
    return (
      <PanelShell title="내 이야기" onClose={onClose}>
        <section className="mb-6">
          <h3 className="text-[#CDFF00] text-sm font-semibold mb-2">오늘 예측</h3>
          {statsLoading ? (
            <p className="text-white/60 text-sm">불러오는 중...</p>
          ) : (
            <p className="text-white text-sm">
              참여 <span className="font-bold text-[#CDFF00]">{todayStats?.total ?? 0}</span>회 ·
              성공 <span className="font-bold text-[#CDFF00]">{todayStats?.wins ?? 0}</span>회
            </p>
          )}
        </section>
        <ul className="space-y-1">
          {storyLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                data-testid={link.testId}
                className="block py-3 px-3 rounded-lg text-white hover:bg-white/10 text-sm border border-transparent hover:border-white/10"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </PanelShell>
    );
  }

  if (panel === "info") {
    return (
      <PanelShell title="내 정보" onClose={onClose}>
        <ul className="space-y-1">
          {infoLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                data-testid={link.testId}
                className="block py-3 px-3 rounded-lg text-white hover:bg-white/10 text-sm"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </PanelShell>
    );
  }

  return null;
}
