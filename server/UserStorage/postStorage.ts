import { PostModel, CommentModel, UserModel, getNextSequence } from "./db";
import type { Post, InsertPost, Comment, InsertComment } from "@shared/schema";
import {
  BADMINTON9_REVENUE_MONGO_FILTER,
  PPAMONG_REVENUE_MONGO_FILTER,
  REVENUE_SOURCE_PPAMONG,
  revenuePlatformFilter,
  type RevenuePlatform,
} from "../utils/revenuePlatform";

export interface AdminPostListItem extends Post {
  authorName: string;
  authorUsername: string;
  commentCount: number;
}

export interface AdminPostListResponse {
  posts: AdminPostListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  platform: RevenuePlatform;
  counts: { ppamong: number; badminton9: number };
}

export interface AdminPostDetail extends Post {
  authorName: string;
  authorUsername: string;
  comments: Array<Comment & { authorName: string }>;
}

/** 앱·관리자 — 회원 UGC는 dataSource로 분리 (작성자 소속과 무관) */
function contentPlatformFilter(platform: RevenuePlatform): Record<string, unknown> {
  return revenuePlatformFilter(platform);
}

export class PostStorage {
  async getPosts(
    page: number,
    limit: number,
    search?: string,
    searchType: "all" | "author" | "title" = "title",
    platform: RevenuePlatform = "ppamong",
  ): Promise<{
    posts: Array<Post & { authorName: string; commentCount: number }>;
    total: number;
    hasMore: boolean;
  }> {
    const offset = (page - 1) * limit;
    // 앱 홈 게시판 — 빠몽 회원 UGC만 (운영자 공식 FAQ성 글 제외)
    const platformFilter =
      platform === "ppamong"
        ? { ...PPAMONG_REVENUE_MONGO_FILTER, isOfficial: { $ne: true } }
        : contentPlatformFilter(platform);

    let postFilter: Record<string, unknown> = { ...platformFilter };

    if (search) {
      if (searchType === "title") {
        postFilter = { ...platformFilter, title: { $regex: search, $options: "i" } };
      } else if (searchType === "author") {
        const authors = await UserModel.find({
          name: { $regex: search, $options: "i" },
        })
          .select("id")
          .lean();
        const authorIds = authors.map((a) => a.id);
        postFilter = {
          ...platformFilter,
          authorId: { $in: authorIds.length ? authorIds : ["__none__"] },
        };
      } else if (searchType === "all") {
        const authors = await UserModel.find({
          name: { $regex: search, $options: "i" },
        })
          .select("id")
          .lean();
        const authorIds = authors.map((a) => a.id);
        postFilter = {
          $and: [
            platformFilter,
            {
              $or: [
                { title: { $regex: search, $options: "i" } },
                { authorId: { $in: authorIds.length ? authorIds : ["__none__"] } },
              ],
            },
          ],
        };
      }
    }

    const [total, posts] = await Promise.all([
      PostModel.countDocuments(postFilter),
      PostModel.find(postFilter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    ]);

    const postsWithComments = await Promise.all(
      posts.map(async (row) => {
        const [author, commentCount] = await Promise.all([
          UserModel.findOne({ id: row.authorId }).select("name").lean(),
          CommentModel.countDocuments({ postId: row.id }),
        ]);
        return {
          ...(row as Post),
          commentCount,
          authorName: author?.name || "Unknown",
        };
      }),
    );

    return {
      posts: postsWithComments,
      total,
      hasMore: offset + posts.length < total,
    };
  }

  async createPost(post: InsertPost): Promise<Post> {
    const id = await getNextSequence("post");
    const doc = await PostModel.create({
      id,
      ...post,
      dataSource: REVENUE_SOURCE_PPAMONG,
      isOfficial: false,
    });
    return doc.toObject() as Post;
  }

  async isPpamongPost(id: number): Promise<boolean> {
    const post = await PostModel.findOne({
      id,
      ...PPAMONG_REVENUE_MONGO_FILTER,
      isOfficial: { $ne: true },
    })
      .select("id")
      .lean();
    return !!post;
  }

  async getPost(id: number): Promise<(Post & { authorName: string }) | undefined> {
    const post = await PostModel.findOne({ id }).lean();
    if (!post) return undefined;

    const author = await UserModel.findOne({ id: post.authorId }).select("name").lean();
    return {
      ...(post as Post),
      authorName: author?.name || "Unknown",
    };
  }

  async incrementViewCount(id: number) {
    await PostModel.updateOne({ id }, { $inc: { viewCount: 1 } });
  }

  async getCommentsByPostId(postId: number): Promise<Array<Comment & { authorName: string }>> {
    const comments = await CommentModel.find({ postId }).sort({ createdAt: 1 }).lean();

    return Promise.all(
      comments.map(async (row) => {
        const author = await UserModel.findOne({ id: row.authorId }).select("name").lean();
        return {
          ...(row as Comment),
          authorName: author?.name || "Unknown",
        };
      }),
    );
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const id = await getNextSequence("comment");
    const doc = await CommentModel.create({ id, ...comment });
    return doc.toObject() as Comment;
  }

  async updateComment(
    id: number,
    content: string,
    userId: string,
  ): Promise<{ success: boolean; message: string; comment?: Comment }> {
    const comment = await CommentModel.findOne({ id }).lean();
    if (!comment) return { success: false, message: "댓글을 찾을 수 없습니다." };
    if (comment.authorId !== userId) return { success: false, message: "작성자만 수정할 수 있습니다." };

    const doc = await CommentModel.findOneAndUpdate({ id }, { content }, { new: true }).lean();
    return {
      success: true,
      message: "댓글이 수정되었습니다.",
      comment: doc as Comment,
    };
  }

  async deleteComment(
    id: number,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const comment = await CommentModel.findOne({ id }).lean();
    if (!comment) return { success: false, message: "댓글을 찾을 수 없습니다." };
    if (comment.authorId !== userId) return { success: false, message: "작성자만 삭제할 수 있습니다." };

    await CommentModel.deleteOne({ id });
    return { success: true, message: "댓글이 삭제되었습니다." };
  }

  async updatePost(
    id: number,
    post: Partial<InsertPost>,
    userId: string,
  ): Promise<{ success: boolean; message: string; post?: Post }> {
    const existing = await PostModel.findOne({ id, ...PPAMONG_REVENUE_MONGO_FILTER }).lean();
    if (!existing) return { success: false, message: "게시물을 찾을 수 없습니다." };
    if (existing.authorId !== userId) return { success: false, message: "작성자만 수정할 수 있습니다." };

    const doc = await PostModel.findOneAndUpdate({ id }, post, { new: true }).lean();
    return {
      success: true,
      message: "게시물이 수정되었습니다.",
      post: doc as Post,
    };
  }

  async deletePost(
    id: number,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await PostModel.findOne({ id, ...PPAMONG_REVENUE_MONGO_FILTER }).lean();
    if (!existing) return { success: false, message: "게시물을 찾을 수 없습니다." };
    if (existing.authorId !== userId) return { success: false, message: "작성자만 삭제할 수 있습니다." };

    await CommentModel.deleteMany({ postId: id });
    await PostModel.deleteOne({ id });
    return { success: true, message: "게시물이 삭제되었습니다." };
  }

  private async countPostsByPlatform(): Promise<{ ppamong: number; badminton9: number }> {
    const [ppamong, badminton9] = await Promise.all([
      PostModel.countDocuments({ ...PPAMONG_REVENUE_MONGO_FILTER, isOfficial: { $ne: true } }),
      PostModel.countDocuments(BADMINTON9_REVENUE_MONGO_FILTER),
    ]);
    return { ppamong, badminton9 };
  }

  async getAdminPosts(
    platform: RevenuePlatform = "ppamong",
    page = 1,
    limit = 8,
    search?: string,
  ): Promise<AdminPostListResponse> {
    const offset = (page - 1) * limit;
    const postFilter: Record<string, unknown> =
      platform === "ppamong"
        ? { ...PPAMONG_REVENUE_MONGO_FILTER, isOfficial: { $ne: true } }
        : { ...contentPlatformFilter(platform) };
    if (search?.trim()) {
      postFilter.title = { $regex: search.trim(), $options: "i" };
    }

    const [total, posts, counts] = await Promise.all([
      PostModel.countDocuments(postFilter),
      PostModel.find(postFilter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      this.countPostsByPlatform(),
    ]);

    const postsWithMeta = await Promise.all(
      posts.map(async (row) => {
        const [author, commentCount] = await Promise.all([
          UserModel.findOne({ id: row.authorId }).select("name username").lean(),
          CommentModel.countDocuments({ postId: row.id }),
        ]);
        return {
          ...(row as Post),
          authorName: author?.name || "Unknown",
          authorUsername: author?.username || "Unknown",
          commentCount,
        };
      }),
    );

    return {
      posts: postsWithMeta,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      platform,
      counts,
    };
  }

  async getAdminPostDetail(id: number): Promise<AdminPostDetail | undefined> {
    const post = await PostModel.findOne({ id }).lean();
    if (!post) return undefined;

    const [author, comments] = await Promise.all([
      UserModel.findOne({ id: post.authorId }).select("name username").lean(),
      this.getCommentsByPostId(id),
    ]);

    return {
      ...(post as Post),
      authorName: author?.name || "Unknown",
      authorUsername: author?.username || "Unknown",
      comments,
    };
  }

  async adminDeletePost(id: number): Promise<boolean> {
    const existing = await PostModel.findOne({ id }).lean();
    if (!existing) return false;
    await CommentModel.deleteMany({ postId: id });
    await PostModel.deleteOne({ id });
    return true;
  }
}

export const postStorage = new PostStorage();
