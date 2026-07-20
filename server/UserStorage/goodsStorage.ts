import {
  GoodsCategoryModel,
  GoodsProductModel,
  getNextSequence,
} from "./db";
import { MALL_CATEGORY_NAMES, MALL_DEFAULT_CATEGORIES } from "@shared/mallConfig";

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
  purchaseUrl: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  categoryName?: string;
}

const SHOP_CATEGORIES = MALL_DEFAULT_CATEGORIES.map((c) => ({ ...c }));
const SHOP_CATEGORY_NAMES = MALL_CATEGORY_NAMES;

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

  async createProduct(data: {
    categoryId: number;
    name: string;
    summary?: string;
    detailContent?: string;
    imageUrl?: string;
    priceLabel?: string;
    priceAmount?: number;
    originalPriceAmount?: number;
    brand?: string;
    purchaseUrl?: string;
    displayOrder?: number;
    isActive?: boolean;
  }): Promise<GoodsProduct> {
    const id = await getNextSequence("goodsProduct");
    const doc = await GoodsProductModel.create({
      id,
      categoryId: data.categoryId,
      name: data.name,
      summary: data.summary ?? "",
      detailContent: data.detailContent ?? "",
      imageUrl: data.imageUrl ?? "",
      priceLabel: data.priceLabel ?? "",
      priceAmount: data.priceAmount ?? 0,
      originalPriceAmount: data.originalPriceAmount ?? 0,
      brand: data.brand ?? "",
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
        "categoryId" | "name" | "summary" | "detailContent" | "imageUrl" | "priceLabel" | "priceAmount" | "originalPriceAmount" | "brand" | "purchaseUrl" | "displayOrder" | "isActive"
      >
    >,
  ): Promise<GoodsProduct | undefined> {
    const doc = await GoodsProductModel.findOneAndUpdate(
      { id },
      { ...data, updatedAt: new Date() },
      { new: true },
    ).lean();
    return doc ? (doc as GoodsProduct) : undefined;
  }

  async deleteProduct(id: number): Promise<void> {
    await GoodsProductModel.deleteOne({ id });
  }
}

export const goodsStorage = new GoodsStorage();
