import {
  GoodsCategoryModel,
  GoodsProductModel,
  getNextSequence,
} from "./db";
import { MALL_CATEGORY_NAMES, MALL_DEFAULT_CATEGORIES } from "@shared/mallConfig";
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
  name: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  productCount?: number;
}

export interface GoodsProduct {
  id: number;
  categoryId: number;
  name: string;
  summary: string;
  detailContent: string;
  imageUrl: string;
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

const SHOP_CATEGORIES = MALL_DEFAULT_CATEGORIES.map((c) => ({ ...c }));
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
    for (const cat of SHOP_CATEGORIES) {
      const existing = await GoodsCategoryModel.findOne({ name: cat.name }).lean();
      if (!existing) {
        const id = await getNextSequence("goodsCategory");
        await GoodsCategoryModel.create({
          id,
          ...cat,
          imageUrl: "",
          isActive: true,
        });
        continue;
      }
      if (existing.displayOrder !== cat.displayOrder) {
        await GoodsCategoryModel.updateOne(
          { id: existing.id },
          { displayOrder: cat.displayOrder, updatedAt: new Date() },
        );
      }
    }
  }

  /** 카테고리별 상품이 없으면 관리자 수정용 예시 상품 1개 생성 */
  async ensureSampleProducts(): Promise<void> {
    await this.ensureDefaultCategories();
    const categories = await GoodsCategoryModel.find({
      name: { $in: SHOP_CATEGORY_NAMES },
    }).lean();

    for (const cat of categories) {
      const count = await GoodsProductModel.countDocuments({ categoryId: cat.id });
      if (count > 0) continue;

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

  async listCategories(activeOnly = false): Promise<GoodsCategory[]> {
    await this.ensureDefaultCategories();
    await this.ensureSampleProducts();
    const filter: Record<string, unknown> = { name: { $in: SHOP_CATEGORY_NAMES } };
    if (activeOnly) filter.isActive = true;
    const categories = await GoodsCategoryModel.find(filter)
      .sort({ displayOrder: 1, id: 1 })
      .lean();

    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const productCount = await GoodsProductModel.countDocuments({
          categoryId: cat.id,
          ...(activeOnly ? { isActive: true } : {}),
        });
        return { ...cat, productCount } as GoodsCategory;
      }),
    );
    return withCounts;
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
    await this.ensureSampleProducts();
    const filter: Record<string, unknown> = { categoryId };
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
      product.variants = nextVariants;
      product.color = summarizeVariantLabels(nextVariants).color;
      product.size = summarizeVariantLabels(nextVariants).size;
    } else if (product.stockQuantity >= 0) {
      product.stockQuantity = Math.max(0, product.stockQuantity - quantity);
    }

    product.updatedAt = new Date();
    await product.save();
  }

  async deleteProduct(id: number): Promise<void> {
    await GoodsProductModel.deleteOne({ id });
  }
}

export const goodsStorage = new GoodsStorage();
