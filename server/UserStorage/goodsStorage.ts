import {
  GoodsCategoryModel,
  GoodsProductModel,
  getNextSequence,
} from "./db";

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
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  categoryName?: string;
}

const SHOP_CATEGORIES = [
  { name: "팀의류", description: "팀 유니폼 · 저지", displayOrder: 1 },
  { name: "패션의류", description: "패션 의류", displayOrder: 2 },
  { name: "마킹키트", description: "마킹 · 네임텍", displayOrder: 3 },
  { name: "모자", description: "야구 모자 · 캡", displayOrder: 4 },
  { name: "야구용품", description: "글러브 · 배트 · 공", displayOrder: 5 },
  { name: "응원용품", description: "응원 도구", displayOrder: 6 },
  { name: "잡화", description: "기타 잡화", displayOrder: 7 },
  { name: "기획상품", description: "한정 기획", displayOrder: 8 },
  { name: "빠몽이 친구들", description: "캐릭터 굿즈", displayOrder: 9 },
  { name: "아울렛", description: "할인 · 아울렛", displayOrder: 10 },
];

const SHOP_CATEGORY_NAMES = SHOP_CATEGORIES.map((c) => c.name);

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

  async listCategories(activeOnly = false): Promise<GoodsCategory[]> {
    await this.ensureDefaultCategories();
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
        "categoryId" | "name" | "summary" | "detailContent" | "imageUrl" | "priceLabel" | "displayOrder" | "isActive"
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
