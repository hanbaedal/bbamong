import { db } from "./db";
import { posts, comments, users } from "@shared/schema";
import { eq, sql, like } from "drizzle-orm";
import type { Post, InsertPost, Comment, InsertComment } from "@shared/schema";

export class PostStorage {

  async getPosts(
    page: number,
    limit: number,
    search?: string,
    searchType: "all" | "author" | "title" = "title"
  ): Promise<{
    posts: Array<Post & { authorName: string; commentCount: number }>;
    total: number;
    hasMore: boolean;
  }> {
    const offset = (page - 1) * limit;

    // 검색 조건 생성
    const buildSearchCondition = () => {
      if (!search) return undefined;
      
      if (searchType === "title") {
        return like(posts.title, `%${search}%`);
      } else if (searchType === "author") {
        return like(users.name, `%${search}%`);
      } else if (searchType === "all") {
        return sql`${posts.title} LIKE ${`%${search}%`} OR ${users.name} LIKE ${`%${search}%`}`;
      }
      return undefined;
    };

    const searchCondition = buildSearchCondition();

    // 전체 개수 조회
    let countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id));
    
    if (searchCondition) {
      countQuery = countQuery.where(searchCondition) as any;
    }
    const countResult = await countQuery;
    const total = countResult[0]?.count || 0;

    // 게시글 조회
    let query = db
      .select({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        authorId: posts.authorId,
        createdAt: posts.createdAt,
        viewCount: posts.viewCount,
        authorName: users.name,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id)) as any;

    if (searchCondition) {
      query = query.where(searchCondition);
    }

    const result = await query
      .orderBy(sql`${posts.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    const postsWithComments = await Promise.all(
      result.map(async (row: typeof result[number]) => {
        const countRes = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(comments)
          .where(eq(comments.postId, row.id));
        return {
          ...row,
          commentCount: countRes[0]?.count || 0,
          authorName: row.authorName || "Unknown",
        };
      })
    );

    return {
      posts: postsWithComments,
      total,
      hasMore: offset + result.length < total,
    };
  }

  async createPost(post: InsertPost): Promise<Post> {
    const result = await db.insert(posts).values(post).returning();
    return result[0];
  }

  async getPost(
    id: number,
  ): Promise<(Post & { authorName: string }) | undefined> {
    const result = await db
      .select({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        authorId: posts.authorId,
        createdAt: posts.createdAt,
        viewCount: posts.viewCount,
        authorName: users.name,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.id, id));

    if (!result[0]) return undefined;
    return { ...result[0], authorName: result[0].authorName || "Unknown" };
  }

  async incrementViewCount(id: number) {
    await db
      .update(posts)
      .set({ viewCount: sql`${posts.viewCount} + 1` })
      .where(eq(posts.id, id));
  }

  // 댓글 CRUD
  async getCommentsByPostId(
    postId: number,
  ): Promise<Array<Comment & { authorName: string }>> {
    const result = await db
      .select({
        id: comments.id,
        postId: comments.postId,
        content: comments.content,
        authorId: comments.authorId,
        createdAt: comments.createdAt,
        authorName: users.name,
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.postId, postId))
      .orderBy(comments.createdAt);

    return result.map((row) => ({
      id: row.id,
      postId: row.postId,
      content: row.content,
      authorId: row.authorId,
      createdAt: row.createdAt,
      authorName: row.authorName || "Unknown",
    }));
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values(comment).returning();
    return result[0];
  }

  async updateComment(
    id: number,
    content: string,
    userId: string,
  ): Promise<{ success: boolean; message: string; comment?: Comment }> {
    const comment = await db.select().from(comments).where(eq(comments.id, id));

    if (!comment[0])
      return { success: false, message: "댓글을 찾을 수 없습니다." };
    if (comment[0].authorId !== userId)
      return { success: false, message: "작성자만 수정할 수 있습니다." };

    const result = await db
      .update(comments)
      .set({ content })
      .where(eq(comments.id, id))
      .returning();
    return {
      success: true,
      message: "댓글이 수정되었습니다.",
      comment: result[0],
    };
  }

  async deleteComment(
    id: number,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const comment = await db.select().from(comments).where(eq(comments.id, id));

    if (!comment[0])
      return { success: false, message: "댓글을 찾을 수 없습니다." };
    if (comment[0].authorId !== userId)
      return { success: false, message: "작성자만 삭제할 수 있습니다." };

    await db.delete(comments).where(eq(comments.id, id));
    return { success: true, message: "댓글이 삭제되었습니다." };
  }

  async updatePost(
    id: number,
    post: Partial<InsertPost>,
    userId: string,
  ): Promise<{ success: boolean; message: string; post?: Post }> {
    const existing = await db.select().from(posts).where(eq(posts.id, id));
    if (!existing[0])
      return { success: false, message: "게시물을 찾을 수 없습니다." };
    if (existing[0].authorId !== userId)
      return { success: false, message: "작성자만 수정할 수 있습니다." };

    const result = await db
      .update(posts)
      .set(post)
      .where(eq(posts.id, id))
      .returning();
    return {
      success: true,
      message: "게시물이 수정되었습니다.",
      post: result[0],
    };
  }

  async deletePost(
    id: number,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await db.select().from(posts).where(eq(posts.id, id));
    if (!existing[0])
      return { success: false, message: "게시물을 찾을 수 없습니다." };
    if (existing[0].authorId !== userId)
      return { success: false, message: "작성자만 삭제할 수 있습니다." };

    await db.delete(posts).where(eq(posts.id, id));
    return { success: true, message: "게시물이 삭제되었습니다." };
  }
}
export const postStorage = new PostStorage();
