import { useLayoutEffect, useRef } from "react";
import { Home, User, Gift, BookOpen } from "lucide-react";

export type GameMenuAction = "home" | "story" | "mall" | "info";

export interface SubmenuAnchor {
  top: number;
  left: number;
  height: number;
}

interface GameLeftMenuProps {
  activePanel: GameMenuAction | null;
  onSelect: (action: GameMenuAction) => void;
  onSubmenuAnchor?: (anchor: SubmenuAnchor | null) => void;
}

const ITEMS: { id: GameMenuAction; label: string; Icon: typeof Home }[] = [
  { id: "home", label: "홈", Icon: Home },
  { id: "story", label: "내이야기", Icon: BookOpen },
  { id: "mall", label: "기념품", Icon: Gift },
  { id: "info", label: "내정보", Icon: User },
];

const SUBMENU_PANELS = new Set<GameMenuAction>(["story", "info"]);

export default function GameLeftMenu({
  activePanel,
  onSelect,
  onSubmenuAnchor,
}: GameLeftMenuProps) {
  const storyRef = useRef<HTMLButtonElement>(null);
  const infoRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!onSubmenuAnchor) return;

    const updateAnchor = () => {
      if (!activePanel || !SUBMENU_PANELS.has(activePanel)) {
        onSubmenuAnchor(null);
        return;
      }

      const el =
        activePanel === "story"
          ? storyRef.current
          : activePanel === "info"
            ? infoRef.current
            : null;
      if (!el) {
        onSubmenuAnchor(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      onSubmenuAnchor({
        top: rect.top,
        left: rect.right + 6,
        height: rect.height,
      });
    };

    updateAnchor();
    window.addEventListener("resize", updateAnchor);
    return () => window.removeEventListener("resize", updateAnchor);
  }, [activePanel, onSubmenuAnchor]);

  return (
    <nav
      className="absolute left-0 top-0 bottom-0 z-30 flex flex-col items-center justify-center gap-2.5 py-3 px-1.5 w-[52px] sm:w-[56px] pointer-events-auto translate-y-6 sm:translate-y-7"
      data-testid="game-left-menu"
    >
      {ITEMS.map(({ id, label, Icon }) => {
        const active = activePanel === id;
        const ref = id === "story" ? storyRef : id === "info" ? infoRef : undefined;
        return (
          <button
            key={id}
            ref={ref}
            type="button"
            data-testid={`game-menu-${id}`}
            onClick={() => onSelect(id)}
            className={`flex flex-col items-center gap-0.5 transition-opacity ${
              active ? "opacity-100" : "opacity-90 hover:opacity-100"
            }`}
          >
            <Icon
              className={`w-6 h-6 sm:w-7 sm:h-7 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] ${
                id === "mall" ? "text-[#DC143C]" : "text-[#FFD700]"
              } ${active ? "scale-110" : ""}`}
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
