import { PostModel, CommentModel, UserModel, getNextSequence } from "./db";
import type { Post, InsertPost, Comment, InsertComment } from "@shared/schema";
import {
  memberPlatformFilter,
  type MemberPlatform,
} from "../utils/memberPlatform";
import {
  PPAMONG_REVENUE_MONGO_FILTER,
  REVENUE_SOURCE_PPAMONG,
  revenuePlatformFilter,
  type RevenuePlatform,
} from "../utils/revenuePlatform";
import {
  PPAMONG_OFFICIAL_AUTHOR_ID,
  PPAMONG_OFFICIAL_DISPLAY_NAME,
  adminSupportPlatformFilter,
  countSupportPlatformPosts,
  ppamongOfficialPostFilter,
} from "../utils/ppamongOfficialContent";

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
  platform: MemberPlatform;
  counts: { ppamong: number; badminton9: number };
}

export interface AdminPostDetail extends Post {
  authorName: string;
  authorUsername: string;
  comments: Array<Comment & { authorName: string }>;
}

export class PostStorage {
  /** 앱 게시판 — 빠몽 운영자(공식) 글만 */
  async getOfficialPosts(): Promise<Array<Post & { authorName: string }>> {
    const posts = await PostModel.find(ppamongOfficialPostFilter())
      .sort({ createdAt: -1 })
      .lean();

    return posts.map((row) => ({
      ...(row as Post),
      authorName: PPAMONG_OFFICIAL_DISPLAY_NAME,
    }));
  }

  async isOfficialPpamongPost(id: number): Promise<boolean> {
    const post = await PostModel.findOne({ id, ...ppamongOfficialPostFilter() })
      .select("id")
      .lean();
    return !!post;
  }

  async createOfficialPost(data: { title: string; content: string }): Promise<Post> {
    const id = await getNextSequence("post");
    const doc = await PostModel.create({
      id,
      title: data.title,
      content: data.content,
      authorId: PPAMONG_OFFICIAL_AUTHOR_ID,
      dataSource: REVENUE_SOURCE_PPAMONG,
      isOfficial: true,
      viewCount: 0,
    });
    return doc.toObject() as Post;
  }

  async updateOfficialPost(
    id: number,
    data: Partial<{ title: string; content: string }>,
  ): Promise<Post | undefined> {
    const doc = await PostModel.findOneAndUpdate(
      { id, ...ppamongOfficialPostFilter() },
      data,
      { new: true },
    ).lean();
    return doc ? (doc as Post) : undefined;
  }

  async adminDeleteOfficialPost(id: number): Promise<boolean> {
    const existing = await PostModel.findOne({ id, ...ppamongOfficialPostFilter() }).lean();
    if (!existing) return false;
    await CommentModel.deleteMany({ postId: id });
    await PostModel.deleteOne({ id });
    return true;
  }

  async getAdminOfficialPosts(
    platform: RevenuePlatform = "ppamong",
    page = 1,
    limit = 8,
    search?: string,
  ): Promise<{
    posts: Array<Post & { authorName: string }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    platform: RevenuePlatform;
    counts: { ppamong: number; badminton9: number };
  }> {
    const filter: Record<string, unknown> = {
      ...adminSupportPlatformFilter(platform),
    };
    if (search?.trim()) {
      filter.title = { $regex: search.trim(), $options: "i" };
    }
    const offset = (page - 1) * limit;
    const [total, posts, counts] = await Promise.all([
      PostModel.countDocuments(filter),
      PostModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      countSupportPlatformPosts(),
    ]);

    return {
      posts: await Promise.all(
        posts.map(async (row) => {
          const isOfficial =
            (row as Post & { isOfficial?: boolean }).isOfficial ||
            row.authorId === PPAMONG_OFFICIAL_AUTHOR_ID;
          if (isOfficial) {
            return { ...(row as Post), authorName: PPAMONG_OFFICIAL_DISPLAY_NAME };
          }
          const author = await UserModel.findOne({ id: row.authorId }).select("name").lean();
          return { ...(row as Post), authorName: author?.name || "Unknown" };
        }),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      platform,
      counts,
    };
  }

  async getPosts(
    page: number,
    limit: number,
    search?: string,
    searchType: "all" | "author" | "title" = "title",
    platform: MemberPlatform = "ppamong",
  ): Promise<{
    posts: Array<Post & { authorName: string; commentCount: number }>;
    total: number;
    hasMore: boolean;
  }> {
    const offset = (page - 1) * limit;
    const ppamongAuthorIds = await this.getAuthorIdsForPlatform(platform);
    const authorScope =
      ppamongAuthorIds.length > 0 ? { authorId: { $in: ppamongAuthorIds } } : { authorId: "__none__" };

    let postFilter: Record<string, unknown> = { ...authorScope };
    let authorIds: string[] | undefined;

    if (search) {
      if (searchType === "title") {
        postFilter = { ...authorScope, title: { $regex: search, $options: "i" } };
      } else if (searchType === "author") {
        const authors = await UserModel.find({
          ...memberPlatformFilter(platform),
          name: { $regex: search, $options: "i" },
        })
          .select("id")
          .lean();
        authorIds = authors.map((a) => a.id);
        postFilter = { authorId: { $in: authorIds.length ? authorIds : ["__none__"] } };
      } else if (searchType === "all") {
        const authors = await UserModel.find({
          ...memberPlatformFilter(platform),
          name: { $regex: search, $options: "i" },
        })
          .select("id")
          .lean();
        authorIds = authors.map((a) => a.id);
        postFilter = {
          $and: [
            authorScope,
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
    const doc = await PostModel.create({ id, ...post });
    return doc.toObject() as Post;
  }

  async isPpamongPost(id: number): Promise<boolean> {
    const post = await PostModel.findOne({ id }).select("authorId").lean();
    if (!post) return false;
    const ppamongIds = await this.getAuthorIdsForPlatform("ppamong");
    return ppamongIds.includes(post.authorId);
  }

  async getPost(id: number): Promise<(Post & { authorName: string }) | undefined> {
    const post = await PostModel.findOne({ id }).lean();
    if (!post) return undefined;

    if ((post as Post & { isOfficial?: boolean }).isOfficial) {
      return {
        ...(post as Post),
        authorName: PPAMONG_OFFICIAL_DISPLAY_NAME,
      };
    }

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
    const existing = await PostModel.findOne({ id }).lean();
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
    const existing = await PostModel.findOne({ id }).lean();
    if (!existing) return { success: false, message: "게시물을 찾을 수 없습니다." };
    if (existing.authorId !== userId) return { success: false, message: "작성자만 삭제할 수 있습니다." };

    await PostModel.deleteOne({ id });
    return { success: true, message: "게시물이 삭제되었습니다." };
  }

  private async getAuthorIdsForPlatform(platform: MemberPlatform): Promise<string[]> {
    const authors = await UserModel.find(memberPlatformFilter(platform)).select("id").lean();
    return authors.map((a) => a.id);
  }

  private async countPostsByPlatform(): Promise<{ ppamong: number; badminton9: number }> {
    const [ppamongIds, badminton9Ids] = await Promise.all([
      this.getAuthorIdsForPlatform("ppamong"),
      this.getAuthorIdsForPlatform("badminton9"),
    ]);
    const [ppamong, badminton9] = await Promise.all([
      ppamongIds.length
        ? PostModel.countDocuments({ authorId: { $in: ppamongIds } })
        : Promise.resolve(0),
      badminton9Ids.length
        ? PostModel.countDocuments({ authorId: { $in: badminton9Ids } })
        : Promise.resolve(0),
    ]);
    return { ppamong, badminton9 };
  }

  async getAdminPosts(
    platform: MemberPlatform = "ppamong",
    page = 1,
    limit = 8,
    search?: string,
  ): Promise<AdminPostListResponse> {
    const authorIds = await this.getAuthorIdsForPlatform(platform);
    const offset = (page - 1) * limit;

    const postFilter: Record<string, unknown> = {
      authorId: { $in: authorIds.length ? authorIds : ["__none__"] },
    };
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
