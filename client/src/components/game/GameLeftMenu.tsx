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
      className="flex flex-col items-center justify-center gap-2 py-3 px-1.5 shrink-0 z-20 w-[52px] sm:w-[56px]"
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
              active ? "opacity-100" : "opacity-85 hover:opacity-100"
            }`}
          >
            <span
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-md flex items-center justify-center ${
                active ? "bg-[#FFD700]/25 ring-1 ring-[#FFD700]" : "bg-black/25"
              }`}
            >
              <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px] text-[#FFD700]" strokeWidth={2} />
            </span>
            <span className="text-[9px] sm:text-[10px] text-white font-medium whitespace-nowrap drop-shadow-md leading-tight">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
