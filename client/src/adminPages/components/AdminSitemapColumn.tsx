import { cn } from "@/lib/utils";
import type { AdminMenuItem } from "../adminMenuConfig";
import { SITEMAP_COLUMN_THEMES } from "../adminMenuConfig";

interface AdminSitemapColumnProps {
  columnId: string;
  label: string;
  items: AdminMenuItem[];
  linkCount: number;
  currentPath: string;
  onNavigate: (path: string) => void;
}

function SitemapLink({
  label,
  path,
  active,
  onNavigate,
  className,
}: {
  label: string;
  path: string;
  active: boolean;
  onNavigate: (path: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(path)}
      className={cn(
        "text-left text-[11px] leading-tight rounded px-1.5 py-0.5 transition-colors w-full",
        active
          ? "text-[#E11936] font-semibold bg-white/80"
          : "text-[#4D4B4E] hover:text-[#E11936] hover:bg-white/60",
        className,
      )}
    >
      {label}
    </button>
  );
}

function SitemapTreeItem({
  item,
  currentPath,
  onNavigate,
  accentBorder,
  depth = 0,
}: {
  item: AdminMenuItem;
  currentPath: string;
  onNavigate: (path: string) => void;
  accentBorder: string;
  depth?: number;
}) {
  const hasChildren = !!item.children?.length;

  if (!hasChildren && item.path) {
    return (
      <li>
        <SitemapLink
          label={item.label}
          path={item.path}
          active={currentPath === item.path}
          onNavigate={onNavigate}
        />
      </li>
    );
  }

  return (
    <li className={depth > 0 ? "mt-0.5" : ""}>
      {item.path ? (
        <SitemapLink
          label={item.label}
          path={item.path}
          active={currentPath === item.path}
          onNavigate={onNavigate}
          className="font-semibold"
        />
      ) : (
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide opacity-80 px-1.5 py-0.5",
            depth > 0 && "mt-0.5",
          )}
        >
          {item.label}
        </p>
      )}
      {hasChildren && (
        <ul
          className={cn(
            "space-y-0",
            depth === 0 ? "mt-0.5 ml-1 pl-1.5 border-l-2" : "ml-1 pl-1.5 border-l",
            accentBorder,
          )}
        >
          {item.children!.map((child) => (
            <SitemapTreeItem
              key={child.id}
              item={child}
              currentPath={currentPath}
              onNavigate={onNavigate}
              accentBorder={accentBorder}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function AdminSitemapColumn({
  columnId,
  label,
  items,
  linkCount,
  currentPath,
  onNavigate,
}: AdminSitemapColumnProps) {
  const theme = SITEMAP_COLUMN_THEMES[columnId] ?? SITEMAP_COLUMN_THEMES.main;

  return (
    <section
      className={cn(
        "min-w-0 flex flex-col rounded-lg border p-2.5 lg:p-3 h-full",
        theme.bg,
        theme.border,
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-black/5">
        <h2 className={cn("text-xs font-bold", theme.headerText)}>{label}</h2>
        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded tabular-nums", theme.badge)}>
          {linkCount}개
        </span>
      </div>

      <ul className="space-y-0.5">
        {items.map((item) => (
          <SitemapTreeItem
            key={item.id}
            item={item}
            currentPath={currentPath}
            onNavigate={onNavigate}
            accentBorder={theme.accentBorder}
          />
        ))}
      </ul>
    </section>
  );
}
