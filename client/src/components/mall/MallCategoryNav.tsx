import { Link } from "wouter";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import type { MallCategory } from "@/lib/mallTypes";

interface MallCategoryNavProps {
  categories: MallCategory[];
  /** null = 전체 */
  activeCategoryId: number | null;
  variant?: "mall" | "admin";
  layout?: "desktop" | "mobile" | "both";
  onSelect?: (categoryId: number | null) => void;
}

const mallItemClass = (active: boolean) =>
  `px-3 py-2 text-sm whitespace-nowrap rounded-md ${
    active ? "font-semibold text-neutral-900 bg-neutral-100" : "text-neutral-600 hover:text-neutral-900"
  }`;

const mallMobileItemClass = (active: boolean) =>
  `px-3 py-1.5 text-xs whitespace-nowrap rounded-full border border-neutral-200 ${
    active ? "font-semibold text-neutral-900 bg-neutral-100" : "text-neutral-600"
  }`;

const adminItemClass = (active: boolean) =>
  `px-3 py-1.5 text-sm whitespace-nowrap rounded-full border ${
    active
      ? "border-[#E11936] bg-[#FFF9FA] text-[#E11936] font-semibold"
      : "border-[#E0E0E0] text-[#666] hover:border-[#E11936]/40"
  }`;

function MallCategoryLinks({
  categories,
  activeCategoryId,
  mobile,
}: {
  categories: MallCategory[];
  activeCategoryId: number | null;
  mobile: boolean;
}) {
  const allActive = activeCategoryId === null;
  const itemClass = mobile ? mallMobileItemClass : mallItemClass;

  return (
    <>
      <Link href={MALL_BASE_PATH} className={itemClass(allActive)}>
        전체
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={`${MALL_BASE_PATH}/category/${cat.id}`}
          className={itemClass(activeCategoryId === cat.id)}
        >
          {cat.name}
        </Link>
      ))}
    </>
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
  const allActive = activeCategoryId === null;

  return (
    <>
      <button type="button" className={adminItemClass(allActive)} onClick={() => onSelect?.(null)}>
        전체
      </button>
      {categories.map((cat) => (
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
        <nav className="hidden lg:flex items-center gap-1 flex-1 overflow-x-auto">
          <MallCategoryLinks categories={categories} activeCategoryId={activeCategoryId} mobile={false} />
        </nav>
      )}
      {(layout === "mobile" || layout === "both") && (
        <div className="lg:hidden pb-2 flex gap-2 overflow-x-auto">
          <MallCategoryLinks categories={categories} activeCategoryId={activeCategoryId} mobile />
        </div>
      )}
    </>
  );
}

export function resolveMallActiveCategoryId(path: string, categories: MallCategory[]): number | null {
  const base = path.split("?")[0];
  const match = base.match(new RegExp(`^${MALL_BASE_PATH}/category/(\\d+)$`));
  if (!match) return null;
  const id = parseInt(match[1], 10);
  return categories.some((c) => c.id === id) ? id : null;
}
