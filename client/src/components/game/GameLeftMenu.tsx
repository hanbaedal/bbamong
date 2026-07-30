import { Home, User, ShoppingBag, BookOpen } from "lucide-react";

export type GameMenuAction = "home" | "story" | "mall" | "info";

interface GameLeftMenuProps {
  activePanel: GameMenuAction | null;
  onSelect: (action: GameMenuAction) => void;
}

const ITEMS: { id: GameMenuAction; label: string; Icon: typeof Home }[] = [
  { id: "home", label: "홈", Icon: Home },
  { id: "story", label: "내이야기", Icon: BookOpen },
  { id: "mall", label: "기념품", Icon: ShoppingBag },
  { id: "info", label: "내정보", Icon: User },
];

export default function GameLeftMenu({ activePanel, onSelect }: GameLeftMenuProps) {
  return (
    <nav
      className="absolute left-0 top-0 bottom-0 z-30 flex flex-col items-center justify-center gap-2.5 py-3 px-1.5 w-[52px] sm:w-[56px] pointer-events-auto"
      data-testid="game-left-menu"
    >
      {ITEMS.map(({ id, label, Icon }) => {
        const active = activePanel === id;
        return (
          <button
            key={id}
            type="button"
            data-testid={`game-menu-${id}`}
            onClick={() => onSelect(id)}
            className={`flex flex-col items-center gap-0.5 transition-opacity ${
              active ? "opacity-100" : "opacity-90 hover:opacity-100"
            }`}
          >
            <Icon
              className={`w-6 h-6 sm:w-7 sm:h-7 text-[#FFD700] drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] ${
                active ? "scale-110" : ""
              }`}
              strokeWidth={2}
            />
            <span
              className={`text-[9px] sm:text-[10px] font-medium whitespace-nowrap leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] ${
                active ? "text-[#FFE566]" : "text-white"
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
