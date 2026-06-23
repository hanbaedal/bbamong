import type { LucideIcon } from "lucide-react";
import {
  Shirt,
  Sparkles,
  PenLine,
  Circle,
  Trophy,
  Megaphone,
  ShoppingBag,
  Star,
  Heart,
  Tag,
} from "lucide-react";

const ICON_BY_NAME: Record<string, LucideIcon> = {
  팀의류: Shirt,
  패션의류: Sparkles,
  마킹키트: PenLine,
  모자: Circle,
  야구용품: Trophy,
  응원용품: Megaphone,
  잡화: ShoppingBag,
  기획상품: Star,
  "빠몽이 친구들": Heart,
  아울렛: Tag,
};

export function getShopCategoryIcon(name: string): LucideIcon {
  return ICON_BY_NAME[name] ?? ShoppingBag;
}
