import { db } from "../UserStorage/db";
import { users, attendanceRecords, pointTransactions, inquiries, posts, comments, ebookPurchases, predictions, adViewHistory, type User } from "@shared/schema";
import { eq, and, ne, sql, desc } from "drizzle-orm";
import { deleteSession } from "../sessionManager";

export interface IAdminUserStorage {
  getRegularUsersPaginated(limit: number, offset: number): Promise<User[]>;
  getRegularUsersCount(): Promise<number>;
  getRegularSuspendedUsersCount(): Promise<number>;
  suspendUser(userId: string, isSuspended: boolean): Promise<User | undefined>;
  restoreUser(userId: string): Promise<User | undefined>;
  hardDeleteUser(userId: string): Promise<boolean>;
  getUserById(userId: string): Promise<User | undefined>;
}

export class AdminUserStorage implements IAdminUserStorage {
  async getRegularUsersPaginated(
    limit: number,
    offset: number,
  ): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(and(eq(users.isSuspended, 0), ne(users.provider, "guest")))
      .orderBy(
        sql`case when ${users.lastLogin} is null then 1 else 0 end`,
        desc(users.lastLogin)
      )
      .limit(limit)
      .offset(offset);
  }

  async getSuspendedUsersPaginated(
    limit: number,
    offset: number,
  ): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(and(eq(users.isSuspended, 1), ne(users.provider, "guest")))
      .orderBy(
        sql`case when ${users.lastLogin} is null then 1 else 0 end`,
        desc(users.lastLogin)
      )
      .limit(limit)
      .offset(offset);
  }

  async getRegularUsersCount(): Promise<number> {
    const result = await db
      .select({ total: sql<number>`count(${users.id})` })
      .from(users)
      .where(and(eq(users.isSuspended, 0), ne(users.provider, "guest")))
      .execute();

    return Number(result[0]?.total ?? 0);
  }

  async getRegularSuspendedUsersCount(): Promise<number> {
    const result = await db
      .select({ total: sql<number>`count(${users.id})` })
      .from(users)
      .where(and(eq(users.isSuspended, 1), ne(users.provider, "guest")))
      .execute();

    return Number(result[0]?.total ?? 0);
  }

  async suspendUser(
    userId: string,
    isSuspended: boolean,
  ): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ 
        isSuspended: isSuspended ? 1 : 0,
        suspendedAt: isSuspended ? new Date() : null,
        lastLogout: isSuspended ? new Date() : undefined,
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async getUserById(userId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, userId));
    return result[0];
  }

  async restoreUser(userId: string): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ isSuspended: 0, suspendedAt: null })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async hardDeleteUser(userId: string): Promise<boolean> {
    const result = await db.transaction(async (tx) => {
      await tx.delete(comments).where(eq(comments.authorId, userId));
      await tx.delete(posts).where(eq(posts.authorId, userId));
      await tx.delete(attendanceRecords).where(eq(attendanceRecords.userId, userId));
      await tx.delete(pointTransactions).where(eq(pointTransactions.userId, userId));
      await tx.delete(inquiries).where(eq(inquiries.userId, userId));
      await tx.delete(ebookPurchases).where(eq(ebookPurchases.userId, userId));
      await tx.delete(predictions).where(eq(predictions.userId, userId));
      await tx.delete(adViewHistory).where(eq(adViewHistory.userId, userId));
      const deleted = await tx.delete(users).where(eq(users.id, userId)).returning();
      return deleted.length > 0;
    });

    try {
      await deleteSession("user", userId);
    } catch (error) {
      console.error("Failed to delete user session:", error);
    }

    return result;
  }
}
