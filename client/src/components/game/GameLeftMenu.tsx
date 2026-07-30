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
      className="flex flex-col items-center justify-center gap-4 sm:gap-5 py-4 px-2 sm:px-3 shrink-0 z-20"
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
            className={`flex flex-col items-center gap-1 min-w-[52px] transition-opacity ${
              active ? "opacity-100" : "opacity-90 hover:opacity-100"
            }`}
          >
            <span
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center ${
                active ? "bg-[#FFD700]/30 ring-2 ring-[#FFD700]" : "bg-[#FFD700]/15"
              }`}
            >
              <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-[#FFD700]" strokeWidth={2} />
            </span>
            <span className="text-[10px] sm:text-xs text-white font-medium whitespace-nowrap drop-shadow-md">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
