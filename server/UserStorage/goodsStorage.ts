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

const DEFAULT_CATEGORIES = [
  { name: "모자", description: "야구 모자 · 캡", displayOrder: 1 },
  { name: "유니폼", description: "팀 유니폼 · 저지", displayOrder: 2 },
  { name: "글러브", description: "야구 글러브", displayOrder: 3 },
  { name: "배트", description: "야구 배트", displayOrder: 4 },
  { name: "야구공", description: "공식구 · 연습구", displayOrder: 5 },
  { name: "응원용품", description: "응원 도구 · 굿즈", displayOrder: 6 },
];

export class GoodsStorage {
  async ensureDefaultCategories(): Promise<void> {
    const count = await GoodsCategoryModel.countDocuments();
    if (count > 0) return;

    for (const cat of DEFAULT_CATEGORIES) {
      const id = await getNextSequence("goodsCategory");
      await GoodsCategoryModel.create({
        id,
        ...cat,
        imageUrl: "",
        isActive: true,
      });
    }
  }

  async listCategories(activeOnly = false): Promise<GoodsCategory[]> {
    await this.ensureDefaultCategories();
    const filter = activeOnly ? { isActive: true } : {};
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
