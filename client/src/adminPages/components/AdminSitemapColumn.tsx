import { cn } from "@/lib/utils";
import type { AdminMenuItem } from "../adminMenuConfig";
import { getAdminSectionCardClass } from "../adminMenuConfig";

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
        "text-left text-[11px] leading-tight rounded px-1.5 py-0.5 transition-colors w-full admin-sitemap-link",
        active && "is-active",
        !active && "text-[#4D4B4E]",
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
  depth = 0,
}: {
  item: AdminMenuItem;
  currentPath: string;
  onNavigate: (path: string) => void;
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
            "admin-sitemap-group-label text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5",
            depth > 0 && "mt-0.5",
          )}
        >
          {item.label}
        </p>
      )}
      {hasChildren && (
        <ul
          className={cn(
            "space-y-0 admin-section-tree-border",
            depth === 0 ? "mt-0.5 ml-1 pl-1.5" : "ml-1 pl-1.5 border-l",
          )}
        >
          {item.children!.map((child) => (
            <SitemapTreeItem
              key={child.id}
              item={child}
              currentPath={currentPath}
              onNavigate={onNavigate}
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
  const themeClass = getAdminSectionCardClass(columnId);

  return (
    <section
      className={cn(
        "admin-section-card min-w-0 flex flex-col p-2.5 lg:p-3 h-full",
        themeClass,
      )}
    >
      <div className="admin-section-card__header">
        <div className="admin-section-card__title-wrap">
          <span className="admin-section-card__accent" aria-hidden />
          <h2 className="admin-section-card__title">{label}</h2>
        </div>
        <span className="admin-section-card__badge">{linkCount}개</span>
      </div>

      <ul className="space-y-0.5">
        {items.map((item) => (
          <SitemapTreeItem
            key={item.id}
            item={item}
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </section>
  );
}
