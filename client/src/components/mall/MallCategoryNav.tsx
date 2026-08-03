import { Link } from "wouter";
import { ChevronDown } from "lucide-react";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import type { MallCategory } from "@/lib/mallTypes";
import { cn } from "@/lib/utils";

interface MallCategoryNavProps {
  categories: MallCategory[];
  /** null = 전체 */
  activeCategoryId: number | null;
  variant?: "mall" | "admin";
  layout?: "desktop" | "mobile" | "both";
  onSelect?: (categoryId: number | null) => void;
}

const mallItemClass = (active: boolean) =>
  cn(
    "px-3 py-2 text-sm whitespace-nowrap rounded-md transition-colors",
    active ? "font-semibold text-neutral-900 bg-neutral-100" : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50",
  );

const mallMobileItemClass = (active: boolean) =>
  cn(
    "px-3 py-1.5 text-xs whitespace-nowrap rounded-full border border-neutral-200",
    active ? "font-semibold text-neutral-900 bg-neutral-100" : "text-neutral-600",
  );

const adminItemClass = (active: boolean) =>
  cn(
    "px-3 py-1.5 text-sm whitespace-nowrap rounded-full border",
    active
      ? "border-[#E11936] bg-[#FFF9FA] text-[#E11936] font-semibold"
      : "border-[#E0E0E0] text-[#666] hover:border-[#E11936]/40",
  );

function isParentActive(parent: MallCategory, activeCategoryId: number | null): boolean {
  if (activeCategoryId == null) return false;
  if (parent.id === activeCategoryId) return true;
  return parent.children?.some((c) => c.id === activeCategoryId) ?? false;
}

function MallMegaMenuDesktop({
  categories,
  activeCategoryId,
}: {
  categories: MallCategory[];
  activeCategoryId: number | null;
}) {
  const allActive = activeCategoryId === null;

  return (
    <nav className="hidden lg:flex items-center gap-0.5 flex-1 overflow-x-auto min-w-0">
      <Link href={MALL_BASE_PATH} className={mallItemClass(allActive)}>
        전체
      </Link>
      {categories.map((parent) => {
        const active = isParentActive(parent, activeCategoryId);
        const hasChildren = (parent.children?.length ?? 0) > 0;

        if (!hasChildren) {
          return (
            <Link
              key={parent.id}
              href={`${MALL_BASE_PATH}/category/${parent.id}`}
              className={mallItemClass(active)}
            >
              {parent.name}
            </Link>
          );
        }

        return (
          <div key={parent.id} className="group relative shrink-0">
            <Link
              href={`${MALL_BASE_PATH}/category/${parent.id}`}
              className={cn(mallItemClass(active), "inline-flex items-center gap-0.5 pr-2")}
            >
              {parent.name}
              <ChevronDown className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
            </Link>
            <div className="invisible absolute left-0 top-full z-50 pt-1 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
              <div className="min-w-[180px] rounded-lg border border-neutral-200 bg-white py-2 shadow-lg">
                <Link
                  href={`${MALL_BASE_PATH}/category/${parent.id}`}
                  className="block px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  {parent.name} 전체
                </Link>
                <div className="my-1 border-t border-neutral-100" />
                {parent.children!.map((child) => (
                  <Link
                    key={child.id}
                    href={`${MALL_BASE_PATH}/category/${child.id}`}
                    className={cn(
                      "block px-4 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
                      activeCategoryId === child.id && "font-semibold text-neutral-900 bg-neutral-50",
                    )}
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function MallCategoryMobile({
  categories,
  activeCategoryId,
}: {
  categories: MallCategory[];
  activeCategoryId: number | null;
}) {
  const allActive = activeCategoryId === null;

  return (
    <div className="lg:hidden pb-2 flex gap-2 overflow-x-auto">
      <Link href={MALL_BASE_PATH} className={mallMobileItemClass(allActive)}>
        전체
      </Link>
      {categories.map((parent) => (
        <Link
          key={parent.id}
          href={`${MALL_BASE_PATH}/category/${parent.id}`}
          className={mallMobileItemClass(isParentActive(parent, activeCategoryId))}
        >
          {parent.name}
        </Link>
      ))}
    </div>
  );
}

function AdminCategoryButtons({
  categories,
  activeCategoryId,
  onSelect,
}: {
  categories: MallCategory[];
  activeCategoryId: number | null;
  onSelect?: (categoryId: number | null) => void;
}) {
  const flat: MallCategory[] = [];
  for (const parent of categories) {
    flat.push(parent);
    if (parent.children) flat.push(...parent.children);
  }

  return (
    <>
      <button type="button" className={adminItemClass(activeCategoryId === null)} onClick={() => onSelect?.(null)}>
        전체
      </button>
      {flat.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={adminItemClass(activeCategoryId === cat.id)}
          onClick={() => onSelect?.(cat.id)}
        >
          {cat.name}
        </button>
      ))}
    </>
  );
}

export default function MallCategoryNav({
  categories,
  activeCategoryId,
  variant = "mall",
  layout = "both",
  onSelect,
}: MallCategoryNavProps) {
  if (variant === "admin") {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        <AdminCategoryButtons
          categories={categories}
          activeCategoryId={activeCategoryId}
          onSelect={onSelect}
        />
      </div>
    );
  }

  return (
    <>
      {(layout === "desktop" || layout === "both") && (
        <MallMegaMenuDesktop categories={categories} activeCategoryId={activeCategoryId} />
      )}
      {(layout === "mobile" || layout === "both") && (
        <MallCategoryMobile categories={categories} activeCategoryId={activeCategoryId} />
      )}
    </>
  );
}

export function resolveMallActiveCategoryId(path: string, categories: MallCategory[]): number | null {
  const base = path.split("?")[0];
  const match = base.match(new RegExp(`^${MALL_BASE_PATH}/category/(\\d+)$`));
  if (!match) return null;
  const id = parseInt(match[1], 10);
  const flat: MallCategory[] = [];
  for (const parent of categories) {
    flat.push(parent);
    if (parent.children) flat.push(...parent.children);
  }
  return flat.some((c) => c.id === id) ? id : null;
}
