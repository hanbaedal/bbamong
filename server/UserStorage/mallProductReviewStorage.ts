import { MallProductReviewModel, getNextSequence } from "./db";

export interface MallProductReview {
  id: number;
  productId: number;
  authorName: string;
  rating: number;
  content: string;
  isVisible: boolean;
  createdAt: Date;
}

export interface MallProductReviewSummary {
  reviews: MallProductReview[];
  totalCount: number;
  averageRating: number;
}

export class MallProductReviewStorage {
  async listForProduct(productId: number, visibleOnly = true): Promise<MallProductReview[]> {
    const filter: Record<string, unknown> = { productId };
    if (visibleOnly) filter.isVisible = true;
    const docs = await MallProductReviewModel.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    return docs as MallProductReview[];
  }

  async getSummary(productId: number): Promise<MallProductReviewSummary> {
    const reviews = await this.listForProduct(productId, true);
    const totalCount = reviews.length;
    const averageRating =
      totalCount > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalCount) * 10) / 10
        : 0;
    return { reviews, totalCount, averageRating };
  }

  async create(data: {
    productId: number;
    authorName: string;
    rating: number;
    content: string;
  }): Promise<MallProductReview> {
    const id = await getNextSequence("mallProductReview");
    const doc = await MallProductReviewModel.create({
      id,
      productId: data.productId,
      authorName: data.authorName,
      rating: data.rating,
      content: data.content,
      isVisible: true,
    });
    return doc.toObject() as MallProductReview;
  }

  async delete(id: number): Promise<boolean> {
    const result = await MallProductReviewModel.deleteOne({ id });
    return result.deletedCount > 0;
  }

  async setVisible(id: number, isVisible: boolean): Promise<MallProductReview | undefined> {
    const doc = await MallProductReviewModel.findOneAndUpdate(
      { id },
      { isVisible },
      { new: true },
    ).lean();
    return doc ? (doc as MallProductReview) : undefined;
  }
}

export const mallProductReviewStorage = new MallProductReviewStorage();
