import {
  GoodsCategoryModel,
  GoodsProductModel,
  getNextSequence,
} from "./db";
import { flattenMallCategoryTree, MALL_CATEGORY_NAMES } from "@shared/mallConfig";
import {
  calculateDiscountedPrice,
  formatProductPriceLabel,
  MALL_DEFAULT_SHIPPING_LABEL,
  MALL_PRODUCT_VARIANT_MAX,
  isProcureFulfillment,
  type MallProductVariant,
  findProductVariant,
  resolveAvailableStock,
  summarizeVariantLabels,
} from "@shared/mallProduct";

export interface GoodsCategory {
  id: number;
  parentId?: number | null;
  name: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  productCount?: number;
  children?: GoodsCategory[];
}

export interface GoodsProduct {
  id: number;
  categoryId: number;
  name: string;
  summary: string;
  detailContent: string;
  imageUrl: string;
  thumbnailUrl?: string;
  priceLabel: string;
  priceAmount?: number;
  originalPriceAmount?: number;
  brand?: string;
  color?: string;
  size?: string;
  stockQuantity?: number;
  variants?: MallProductVariant[];
  fulfillmentType?: "stock" | "procure";
  procureNotice?: string;
  reorderPoint?: number;
  optimalStock?: number;
  discountPercent?: number;
  shippingLabel?: string;
  detailImages?: string[];
  purchaseUrl: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  categoryName?: string;
}

const SHOP_CATEGORIES = flattenMallCategoryTree();
const SHOP_CATEGORY_NAMES = MALL_CATEGORY_NAMES;

function normalizeProductPricing(data: {
  priceAmount?: number;
  originalPriceAmount?: number;
  discountPercent?: number;
  priceLabel?: string;
}) {
  const original = Math.max(0, data.originalPriceAmount ?? 0);
  const discountPercent = Math.min(100, Math.max(0, data.discountPercent ?? 0));
  const priceAmount =
    original > 0
      ? calculateDiscountedPrice(original, discountPercent)
      : Math.max(0, data.priceAmount ?? 0);

  return {
    originalPriceAmount: original,
    discountPercent,
    priceAmount,
    priceLabel: priceAmount > 0 ? formatProductPriceLabel(priceAmount) : data.priceLabel ?? "",
  };
}

function normalizeVariants(raw?: MallProductVariant[]): MallProductVariant[] {
  if (!raw?.length) return [];
  return raw
    .map((v) => ({
      color: (v.color ?? "").trim(),
      size: (v.size ?? "").trim(),
      stock: Math.max(0, v.stock ?? 0),
    }))
    .filter((v) => v.color || v.size)
    .slice(0, MALL_PRODUCT_VARIANT_MAX);
}

function normalizeStockQuantity(raw?: number): number {
  if (raw === undefined || raw === null) return -1;
  return Math.max(-1, raw);
}

export class GoodsStorage {
  async ensureDefaultCategories(): Promise<void> {
    const nameToId = new Map<string, number>();

    for (const cat of SHOP_CATEGORIES.filter((c) => !c.parentName)) {
      const existing = await GoodsCategoryModel.findOne({ name: cat.name, parentId: null }).lean();
      if (!existing) {
        const id = await getNextSequence("goodsCategory");
        await GoodsCategoryModel.create({
          id,
          parentId: null,
          name: cat.name,
          description: cat.description,
          displayOrder: cat.displayOrder,
          imageUrl: "",
          isActive: true,
        });
        nameToId.set(cat.name, id);
      } else {
        nameToId.set(cat.name, existing.id as number);
        if (existing.displayOrder !== cat.displayOrder || existing.description !== cat.description) {
          await GoodsCategoryModel.updateOne(
            { id: existing.id },
            { displayOrder: cat.displayOrder, description: cat.description, updatedAt: new Date() },
          );
        }
      }
    }

    for (const cat of SHOP_CATEGORIES.filter((c) => c.parentName)) {
      const parentId = nameToId.get(cat.parentName!);
      if (!parentId) continue;
      const existing = await GoodsCategoryModel.findOne({ name: cat.name, parentId }).lean();
      if (!existing) {
        const id = await getNextSequence("goodsCategory");
        await GoodsCategoryModel.create({
          id,
          parentId,
          name: cat.name,
          description: cat.description,
          displayOrder: cat.displayOrder,
          imageUrl: "",
          isActive: true,
        });
      } else if (existing.displayOrder !== cat.displayOrder || existing.description !== cat.description) {
        await GoodsCategoryModel.updateOne(
          { id: existing.id },
          { displayOrder: cat.displayOrder, description: cat.description, updatedAt: new Date() },
        );
      }
    }

    await GoodsCategoryModel.updateMany(
      { name: "중고나라" },
      { isActive: false, updatedAt: new Date() },
    );
    await GoodsCategoryModel.updateMany(
      { name: { $nin: SHOP_CATEGORY_NAMES } },
      { isActive: false, updatedAt: new Date() },
    );
  }

  /** 카테고리별 상품이 없으면 관리자 수정용 예시 상품 1개 생성 (빠몽이상품 등 시드 전용) */
  async ensureSampleProducts(): Promise<void> {
    await this.ensureDefaultCategories();
    const categories = await GoodsCategoryModel.find({
      name: { $in: SHOP_CATEGORY_NAMES },
      isActive: true,
    }).lean();

    for (const cat of categories) {
      const count = await GoodsProductModel.countDocuments({ categoryId: cat.id });
      if (count > 0) continue;
      if (cat.parentId == null && (cat.name !== "빠몽이상품")) continue;

      await this.createProduct({
        categoryId: cat.id,
        name: `${cat.name} 상품 (등록 예정)`,
        summary: "관리자 홈페이지 관리에서 상품 정보를 수정하세요.",
        detailContent:
          "이 상품은 자동 생성된 예시입니다.\n관리자 → 홈페이지 관리 → 굿즈 상품 탭에서 수정·삭제할 수 있습니다.",
        priceLabel: "가격 문의",
        purchaseUrl: "",
        isActive: true,
      });
    }
  }

  private async resolveCategoryIdsIncludingChildren(categoryId: number): Promise<number[]> {
    await this.ensureDefaultCategories();
    const childIds = await GoodsCategoryModel.find({ parentId: categoryId, isActive: true })
      .select("id")
      .lean();
    if (childIds.length > 0) {
      return childIds.map((c) => c.id as number);
    }
    return [categoryId];
  }

  buildCategoryTree(categories: GoodsCategory[]): GoodsCategory[] {
    const byId = new Map(categories.map((c) => [c.id, { ...c, children: [] as GoodsCategory[] }]));
    const roots: GoodsCategory[] = [];
    for (const cat of byId.values()) {
      if (cat.parentId != null && byId.has(cat.parentId)) {
        byId.get(cat.parentId)!.children!.push(cat);
      } else if (cat.parentId == null) {
        roots.push(cat);
      }
    }
    for (const root of roots) {
      root.children?.sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
    }
    return roots.sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
  }

  async listCategories(activeOnly = false): Promise<GoodsCategory[]> {
    await this.ensureDefaultCategories();
    const filter: Record<string, unknown> = { name: { $in: SHOP_CATEGORY_NAMES } };
    if (activeOnly) filter.isActive = true;
    const categories = await GoodsCategoryModel.find(filter)
      .sort({ displayOrder: 1, id: 1 })
      .lean();

    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const categoryIds = await this.resolveCategoryIdsIncludingChildren(cat.id as number);
        const productCount = await GoodsProductModel.countDocuments({
          categoryId: { $in: categoryIds },
          ...(activeOnly ? { isActive: true } : {}),
        });
        return { ...cat, productCount } as GoodsCategory;
      }),
    );
    return withCounts;
  }

  async listCategoryTree(activeOnly = false): Promise<GoodsCategory[]> {
    const flat = await this.listCategories(activeOnly);
    return this.buildCategoryTree(flat);
  }

  async getCategory(id: number, activeOnly = false): Promise<GoodsCategory | undefined> {
    const filter: Record<string, unknown> = { id };
    if (activeOnly) filter.isActive = true;
    const doc = await GoodsCategoryModel.findOne(filter).lean();
    return doc ? (doc as GoodsCategory) : undefined;
  }

  async createCategory(data: {
    name: string;
    description?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    displayOrder?: number;
    isActive?: boolean;
  }): Promise<GoodsCategory> {
    const id = await getNextSequence("goodsCategory");
    const doc = await GoodsCategoryModel.create({
      id,
      name: data.name,
      description: data.description ?? "",
      imageUrl: data.imageUrl ?? "",
      displayOrder: data.displayOrder ?? id,
      isActive: data.isActive ?? true,
    });
    return doc.toObject() as GoodsCategory;
  }

  async updateCategory(
    id: number,
    data: Partial<Pick<GoodsCategory, "name" | "description" | "imageUrl" | "displayOrder" | "isActive">>,
  ): Promise<GoodsCategory | undefined> {
    const doc = await GoodsCategoryModel.findOneAndUpdate(
      { id },
      { ...data, updatedAt: new Date() },
      { new: true },
    ).lean();
    return doc ? (doc as GoodsCategory) : undefined;
  }

  async deleteCategory(id: number): Promise<void> {
    await GoodsProductModel.deleteMany({ categoryId: id });
    await GoodsCategoryModel.deleteOne({ id });
  }

  async listProductsByCategory(categoryId: number, activeOnly = false): Promise<GoodsProduct[]> {
    const categoryIds = await this.resolveCategoryIdsIncludingChildren(categoryId);
    const filter: Record<string, unknown> = { categoryId: { $in: categoryIds } };
    if (activeOnly) filter.isActive = true;
    const docs = await GoodsProductModel.find(filter)
      .sort({ displayOrder: 1, id: 1 })
      .lean();
    return docs as GoodsProduct[];
  }

  async listAllProducts(activeOnly = false): Promise<GoodsProduct[]> {
    const filter = activeOnly ? { isActive: true } : {};
    const docs = await GoodsProductModel.find(filter)
      .sort({ categoryId: 1, displayOrder: 1, id: 1 })
      .lean();
    return docs as GoodsProduct[];
  }

  async getProduct(id: number, activeOnly = false): Promise<GoodsProduct | undefined> {
    const filter: Record<string, unknown> = { id };
    if (activeOnly) filter.isActive = true;
    const doc = await GoodsProductModel.findOne(filter).lean();
    if (!doc) return undefined;
    const category = await GoodsCategoryModel.findOne({ id: doc.categoryId })
      .select("name")
      .lean();
    return { ...doc, categoryName: category?.name } as GoodsProduct;
  }

  async listRelatedProducts(productId: number, limit = 8): Promise<GoodsProduct[]> {
    const product = await this.getProduct(productId, true);
    if (!product) return [];
    const docs = await GoodsProductModel.find({
      categoryId: product.categoryId,
      isActive: true,
      id: { $ne: productId },
    })
      .sort({ displayOrder: 1, id: 1 })
      .limit(limit)
      .lean();
    return docs as GoodsProduct[];
  }

  async createProduct(data: {
    categoryId: number;
    name: string;
    summary?: string;
    detailContent?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    priceLabel?: string;
    priceAmount?: number;
    originalPriceAmount?: number;
    discountPercent?: number;
    brand?: string;
    color?: string;
    size?: string;
    stockQuantity?: number;
    variants?: MallProductVariant[];
    fulfillmentType?: "stock" | "procure";
    procureNotice?: string;
    reorderPoint?: number;
    optimalStock?: number;
    shippingLabel?: string;
    detailImages?: string[];
    purchaseUrl?: string;
    displayOrder?: number;
    isActive?: boolean;
  }): Promise<GoodsProduct> {
    const id = await getNextSequence("goodsProduct");
    const pricing = normalizeProductPricing(data);
    const variants = normalizeVariants(data.variants);
    const variantLabels = variants.length > 0 ? summarizeVariantLabels(variants) : null;
    const doc = await GoodsProductModel.create({
      id,
      categoryId: data.categoryId,
      name: data.name,
      summary: data.summary ?? "",
      detailContent: data.detailContent ?? "",
      imageUrl: data.imageUrl ?? "",
      thumbnailUrl: data.thumbnailUrl ?? "",
      priceLabel: pricing.priceLabel,
      priceAmount: pricing.priceAmount,
      originalPriceAmount: pricing.originalPriceAmount,
      discountPercent: pricing.discountPercent,
      brand: data.brand ?? "",
      color: variantLabels?.color ?? data.color ?? "",
      size: variantLabels?.size ?? data.size ?? "",
      stockQuantity: variants.length > 0 ? -1 : normalizeStockQuantity(data.stockQuantity),
      variants,
      fulfillmentType: data.fulfillmentType === "procure" ? "procure" : "stock",
      procureNotice: data.procureNotice ?? "",
      reorderPoint: Math.max(0, data.reorderPoint ?? 0),
      optimalStock: Math.max(0, data.optimalStock ?? 0),
      shippingLabel: data.shippingLabel ?? MALL_DEFAULT_SHIPPING_LABEL,
      detailImages: (data.detailImages ?? []).slice(0, 10),
      purchaseUrl: data.purchaseUrl ?? "",
      displayOrder: data.displayOrder ?? id,
      isActive: data.isActive ?? true,
    });
    return doc.toObject() as GoodsProduct;
  }

  async updateProduct(
    id: number,
    data: Partial<
      Pick<
        GoodsProduct,
        | "categoryId"
        | "name"
        | "summary"
        | "detailContent"
        | "imageUrl"
        | "thumbnailUrl"
        | "priceLabel"
        | "priceAmount"
        | "originalPriceAmount"
        | "discountPercent"
        | "brand"
        | "color"
        | "size"
        | "stockQuantity"
        | "variants"
        | "fulfillmentType"
        | "procureNotice"
        | "reorderPoint"
        | "optimalStock"
        | "shippingLabel"
        | "detailImages"
        | "purchaseUrl"
        | "displayOrder"
        | "isActive"
      >
    >,
  ): Promise<GoodsProduct | undefined> {
    const existing = await GoodsProductModel.findOne({ id }).lean();
    if (!existing) return undefined;

    const pricing = normalizeProductPricing({
      priceAmount: data.priceAmount ?? existing.priceAmount,
      originalPriceAmount: data.originalPriceAmount ?? existing.originalPriceAmount,
      discountPercent: data.discountPercent ?? existing.discountPercent,
      priceLabel: data.priceLabel ?? existing.priceLabel,
    });

    const variants =
      data.variants !== undefined ? normalizeVariants(data.variants) : normalizeVariants(existing.variants);
    const variantLabels = variants.length > 0 ? summarizeVariantLabels(variants) : null;
    const stockQuantity =
      data.stockQuantity !== undefined
        ? normalizeStockQuantity(data.stockQuantity)
        : variants.length > 0
          ? -1
          : normalizeStockQuantity(existing.stockQuantity);

    const doc = await GoodsProductModel.findOneAndUpdate(
      { id },
      {
        ...data,
        color: variantLabels?.color ?? data.color ?? existing.color,
        size: variantLabels?.size ?? data.size ?? existing.size,
        stockQuantity,
        variants,
        priceLabel: pricing.priceLabel,
        priceAmount: pricing.priceAmount,
        originalPriceAmount: pricing.originalPriceAmount,
        discountPercent: pricing.discountPercent,
        detailImages: data.detailImages ? data.detailImages.slice(0, 10) : undefined,
        updatedAt: new Date(),
      },
      { new: true },
    ).lean();
    return doc ? (doc as GoodsProduct) : undefined;
  }

  validateOrderStock(
    product: GoodsProduct,
    quantity: number,
    color?: string,
    size?: string,
  ): string | null {
    if (isProcureFulfillment(product.fulfillmentType)) return null;
    const available = resolveAvailableStock(product, color, size);
    if (available === null) return null;
    if (available < quantity) {
      const label = [color, size].filter(Boolean).join(" / ");
      return label
        ? `"${product.name}" (${label}) 재고가 부족합니다. (남은 수량: ${available})`
        : `"${product.name}" 재고가 부족합니다. (남은 수량: ${available})`;
    }
    return null;
  }

  async decrementStock(
    productId: number,
    quantity: number,
    color?: string,
    size?: string,
  ): Promise<void> {
    const product = await GoodsProductModel.findOne({ id: productId });
    if (!product) return;
    if (isProcureFulfillment(product.fulfillmentType as string)) return;

    const variants = normalizeVariants(product.variants as MallProductVariant[]);
    if (variants.length > 0) {
      const variant = findProductVariant(variants, color ?? "", size ?? "");
      if (!variant) return;
      const nextVariants = variants.map((v) =>
        v.color === variant.color && v.size === variant.size
          ? { ...v, stock: Math.max(0, v.stock - quantity) }
          : v,
      );
      product.set("variants", nextVariants);
      product.color = summarizeVariantLabels(nextVariants).color;
      product.size = summarizeVariantLabels(nextVariants).size;
    } else if (product.stockQuantity >= 0) {
      product.stockQuantity = Math.max(0, product.stockQuantity - quantity);
    }

    product.updatedAt = new Date();
    await product.save();
  }

  async incrementStock(
    productId: number,
    quantity: number,
    color?: string,
    size?: string,
  ): Promise<void> {
    const product = await GoodsProductModel.findOne({ id: productId });
    if (!product) return;
    if (isProcureFulfillment(product.fulfillmentType as string)) return;

    const variants = normalizeVariants(product.variants as MallProductVariant[]);
    if (variants.length > 0) {
      const variant = findProductVariant(variants, color ?? "", size ?? "");
      if (!variant) return;
      const nextVariants = variants.map((v) =>
        v.color === variant.color && v.size === variant.size
          ? { ...v, stock: v.stock + quantity }
          : v,
      );
      product.set("variants", nextVariants);
      product.color = summarizeVariantLabels(nextVariants).color;
      product.size = summarizeVariantLabels(nextVariants).size;
    } else if (product.stockQuantity >= 0) {
      product.stockQuantity = product.stockQuantity + quantity;
    } else {
      product.stockQuantity = quantity;
    }

    product.updatedAt = new Date();
    await product.save();
  }

  async listReorderAlerts(): Promise<
    Array<{
      productId: number;
      name: string;
      color: string;
      size: string;
      stock: number;
      reorderPoint: number;
      optimalStock: number;
    }>
  > {
    const products = await GoodsProductModel.find({
      fulfillmentType: { $ne: "procure" },
      isActive: true,
    }).lean();

    const alerts: Array<{
      productId: number;
      name: string;
      color: string;
      size: string;
      stock: number;
      reorderPoint: number;
      optimalStock: number;
    }> = [];

    for (const p of products) {
      const reorderPoint = p.reorderPoint ?? 0;
      if (reorderPoint <= 0) continue;
      const optimalStock = p.optimalStock ?? 0;
      const variants = normalizeVariants(p.variants as MallProductVariant[]);
      if (variants.length > 0) {
        for (const v of variants) {
          if (v.stock <= reorderPoint) {
            alerts.push({
              productId: p.id,
              name: p.name,
              color: v.color,
              size: v.size,
              stock: v.stock,
              reorderPoint,
              optimalStock,
            });
          }
        }
      } else {
        const stock = p.stockQuantity >= 0 ? p.stockQuantity : 0;
        if (stock <= reorderPoint) {
          alerts.push({
            productId: p.id,
            name: p.name,
            color: "",
            size: "",
            stock,
            reorderPoint,
            optimalStock,
          });
        }
      }
    }
    return alerts;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await GoodsProductModel.deleteOne({ id });
    return (result.deletedCount ?? 0) > 0;
  }

  async deleteProducts(ids: number[]): Promise<number> {
    const uniqueIds = [...new Set(ids.filter((id) => Number.isFinite(id)))];
    if (uniqueIds.length === 0) return 0;
    const result = await GoodsProductModel.deleteMany({ id: { $in: uniqueIds } });
    return result.deletedCount ?? 0;
  }
}

export const goodsStorage = new GoodsStorage();
