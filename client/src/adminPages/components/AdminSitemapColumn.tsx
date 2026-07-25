import { cn } from "@/lib/utils";
import type { AdminMenuItem } from "../adminMenuConfig";

interface AdminSitemapColumnProps {
  label: string;
  items: AdminMenuItem[];
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
        "text-left text-sm leading-snug rounded px-2 py-1 -mx-2 transition-colors w-full",
        active
          ? "text-[#E11936] font-semibold bg-[#FFF0F2]"
          : "text-[#4D4B4E] hover:text-[#E11936] hover:bg-[#FFF9FA]",
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
    <li className={depth > 0 ? "mt-2" : ""}>
      {item.path ? (
        <SitemapLink
          label={item.label}
          path={item.path}
          active={currentPath === item.path}
          onNavigate={onNavigate}
          className="font-medium"
        />
      ) : (
        <p
          className={cn(
            "text-xs font-semibold text-[#9CA3AF] px-2 -mx-2 mb-1",
            depth > 0 && "mt-1",
          )}
        >
          {item.label}
        </p>
      )}
      {hasChildren && (
        <ul
          className={cn(
            "space-y-0.5",
            depth === 0 ? "mt-1 ml-2 pl-2 border-l border-[#E8D4D8]" : "ml-2 pl-2 border-l border-[#EEE4E6]",
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
  label,
  items,
  currentPath,
  onNavigate,
}: AdminSitemapColumnProps) {
  return (
    <section className="min-w-0 flex flex-col">
      <h2 className="text-sm font-bold text-[#201E22] pb-2 mb-2 border-b border-[#E5E7EB]">
        {label}
      </h2>
      <ul className="space-y-1">
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
