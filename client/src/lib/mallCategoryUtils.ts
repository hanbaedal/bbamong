import type { MallCategory } from "@/lib/mallTypes";

export function flattenMallCategories(categories: MallCategory[]): MallCategory[] {
  const flat: MallCategory[] = [];
  for (const cat of categories) {
    flat.push(cat);
    if (cat.children?.length) {
      flat.push(...cat.children);
    }
  }
  return flat;
}

export function findMallCategoryById(
  categories: MallCategory[],
  id: number,
): MallCategory | undefined {
  return flattenMallCategories(categories).find((c) => c.id === id);
}

export function findMallCategoryParent(
  categories: MallCategory[],
  categoryId: number,
): MallCategory | undefined {
  for (const parent of categories) {
    if (parent.id === categoryId) return parent;
    if (parent.children?.some((c) => c.id === categoryId)) return parent;
  }
  return undefined;
}
