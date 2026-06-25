import { getShopCategoryVisual } from "@/lib/shopCategoryIcons";

interface ShopCategoryItem {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
}

interface ShopCategoryGridProps {
  categories: ShopCategoryItem[];
  isLoading?: boolean;
  onSelect: (categoryId: number) => void;
}

export default function ShopCategoryGrid({
  categories,
  isLoading = false,
  onSelect,
}: ShopCategoryGridProps) {
  if (isLoading) {
    return <p className="text-[#666] text-sm text-center py-12">불러오는 중...</p>;
  }

  if (categories.length === 0) {
    return <p className="text-[#888] text-sm text-center py-12">준비 중입니다.</p>;
  }

  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-5 pb-6">
      {categories.map((cat) => {
        const { Icon, iconColor, bgColor } = getShopCategoryVisual(cat.name, cat.description);
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className="relative z-10 flex flex-col items-center gap-1.5 min-w-0"
          >
            <div
              className="w-12 h-12 rounded-xl border border-[#333] flex items-center justify-center"
              style={{ backgroundColor: bgColor }}
            >
              {cat.imageUrl ? (
                <img src={cat.imageUrl} alt="" className="w-7 h-7 object-contain" />
              ) : (
                <Icon className="w-6 h-6" strokeWidth={1.75} style={{ color: iconColor }} />
              )}
            </div>
            <span className="text-[#D5D5D5] text-[10px] leading-tight text-center line-clamp-2 w-full">
              {cat.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
