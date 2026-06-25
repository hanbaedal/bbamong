import type { LucideIcon } from "lucide-react";
import {
  Shirt,
  Sparkles,
  PenLine,
  HardHat,
  Trophy,
  Megaphone,
  ShoppingBag,
  Star,
  Heart,
  Percent,
  Package,
  Users,
} from "lucide-react";

export interface ShopCategoryVisual {
  Icon: LucideIcon;
  iconColor: string;
  bgColor: string;
}

const CATEGORY_VISUALS: Record<string, ShopCategoryVisual> = {
  팀의류: { Icon: Shirt, iconColor: "#38BDF8", bgColor: "#0C2D42" },
  패션의류: { Icon: Sparkles, iconColor: "#F472B6", bgColor: "#3B1A2E" },
  마킹키트: { Icon: PenLine, iconColor: "#FB923C", bgColor: "#3B220F" },
  모자: { Icon: HardHat, iconColor: "#A78BFA", bgColor: "#2A1F45" },
  야구용품: { Icon: Trophy, iconColor: "#FACC15", bgColor: "#3B3208" },
  응원용품: { Icon: Megaphone, iconColor: "#4ADE80", bgColor: "#0F3320" },
  잡화: { Icon: ShoppingBag, iconColor: "#94A3B8", bgColor: "#1E293B" },
  기획상품: { Icon: Star, iconColor: "#FCD34D", bgColor: "#3B3008" },
  "빠몽이 친구들": { Icon: Heart, iconColor: "#FB7185", bgColor: "#3B1520" },
  아울렛: { Icon: Percent, iconColor: "#2DD4BF", bgColor: "#0F3330" },
};

const KEYWORD_VISUALS: { keywords: string[]; visual: ShopCategoryVisual }[] = [
  { keywords: ["유니폼", "저지", "팀의"], visual: CATEGORY_VISUALS["팀의류"] },
  { keywords: ["패션", "의류"], visual: CATEGORY_VISUALS["패션의류"] },
  { keywords: ["마킹", "네임텍"], visual: CATEGORY_VISUALS["마킹키트"] },
  { keywords: ["모자", "캡"], visual: CATEGORY_VISUALS["모자"] },
  { keywords: ["글러브", "배트", "야구용"], visual: CATEGORY_VISUALS["야구용품"] },
  { keywords: ["응원"], visual: CATEGORY_VISUALS["응원용품"] },
  { keywords: ["잡화", "기타"], visual: CATEGORY_VISUALS["잡화"] },
  { keywords: ["기획", "한정"], visual: CATEGORY_VISUALS["기획상품"] },
  { keywords: ["빠몽", "친구", "캐릭터"], visual: CATEGORY_VISUALS["빠몽이 친구들"] },
  { keywords: ["아울렛", "할인"], visual: CATEGORY_VISUALS["아울렛"] },
];

const DEFAULT_VISUAL: ShopCategoryVisual = {
  Icon: Package,
  iconColor: "#CDFF00",
  bgColor: "#252525",
};

export function getShopCategoryVisual(name: string, description?: string): ShopCategoryVisual {
  const trimmed = name.trim();
  if (CATEGORY_VISUALS[trimmed]) {
    return CATEGORY_VISUALS[trimmed];
  }

  const haystack = `${trimmed} ${description ?? ""}`;
  for (const { keywords, visual } of KEYWORD_VISUALS) {
    if (keywords.some((kw) => haystack.includes(kw))) {
      return visual;
    }
  }

  return DEFAULT_VISUAL;
}

/** @deprecated getShopCategoryVisual 사용 */
export function getShopCategoryIcon(name: string): LucideIcon {
  return getShopCategoryVisual(name).Icon;
}
