import { MallWishlistModel } from "../mongodb/models";

export class MallWishlistStorage {
  async listProductIds(userId: string): Promise<number[]> {
    const docs = await MallWishlistModel.find({ userId })
      .sort({ createdAt: -1 })
      .select("productId")
      .lean();
    return docs.map((d) => d.productId as number);
  }

  async isWishlisted(userId: string, productId: number): Promise<boolean> {
    const doc = await MallWishlistModel.findOne({ userId, productId }).lean();
    return Boolean(doc);
  }

  async add(userId: string, productId: number): Promise<void> {
    await MallWishlistModel.updateOne(
      { userId, productId },
      { $setOnInsert: { userId, productId, createdAt: new Date() } },
      { upsert: true },
    );
  }

  async remove(userId: string, productId: number): Promise<boolean> {
    const result = await MallWishlistModel.deleteOne({ userId, productId });
    return result.deletedCount > 0;
  }

  async toggle(userId: string, productId: number): Promise<boolean> {
    const existing = await MallWishlistModel.findOne({ userId, productId }).lean();
    if (existing) {
      await MallWishlistModel.deleteOne({ userId, productId });
      return false;
    }
    await MallWishlistModel.create({ userId, productId, createdAt: new Date() });
    return true;
  }
}

export const mallWishlistStorage = new MallWishlistStorage();
