import { PostModel, CommentModel, UserModel, getNextSequence } from "./db";
import type { Post, InsertPost, Comment, InsertComment } from "@shared/schema";

export class PostStorage {
  async getPosts(
    page: number,
    limit: number,
    search?: string,
    searchType: "all" | "author" | "title" = "title",
  ): Promise<{
    posts: Array<Post & { authorName: string; commentCount: number }>;
    total: number;
    hasMore: boolean;
  }> {
    const offset = (page - 1) * limit;

    let postFilter: Record<string, unknown> = {};
    let authorIds: string[] | undefined;

    if (search) {
      if (searchType === "title") {
        postFilter = { title: { $regex: search, $options: "i" } };
      } else if (searchType === "author") {
        const authors = await UserModel.find({ name: { $regex: search, $options: "i" } })
          .select("id")
          .lean();
        authorIds = authors.map((a) => a.id);
        postFilter = { authorId: { $in: authorIds } };
      } else if (searchType === "all") {
        const authors = await UserModel.find({ name: { $regex: search, $options: "i" } })
          .select("id")
          .lean();
        authorIds = authors.map((a) => a.id);
        postFilter = {
          $or: [
            { title: { $regex: search, $options: "i" } },
            { authorId: { $in: authorIds } },
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
}

export const postStorage = new PostStorage();
