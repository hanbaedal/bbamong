import { cn } from "@/lib/utils";
import type { LandscapeTheme } from "@/lib/landscapeTheme";
import { LANDSCAPE_THEME_CLASS } from "@/lib/landscapeTheme";

export interface HubMenuItem {
  id: string;
  label: string;
  testId?: string;
  danger?: boolean;
}

interface LandscapeHubMenuProps {
  theme: LandscapeTheme;
  items: HubMenuItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDangerAction?: (id: string) => void;
}

export default function LandscapeHubMenu({
  theme,
  items,
  activeId,
  onSelect,
  onDangerAction,
}: LandscapeHubMenuProps) {
  return (
    <ul className={cn("lscape-hub-menu", LANDSCAPE_THEME_CLASS[theme])}>
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            data-testid={item.testId}
            onClick={() => {
              if (item.danger) {
                onDangerAction?.(item.id);
                return;
              }
              onSelect(item.id);
            }}
            className={cn(
              "lscape-hub-menu__item",
              activeId === item.id && !item.danger && "lscape-hub-menu__item--active",
              item.danger && "lscape-hub-menu__item--danger",
            )}
          >
            <span className="lscape-hub-menu__dot" aria-hidden />
            <span className="lscape-hub-menu__label">{item.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
