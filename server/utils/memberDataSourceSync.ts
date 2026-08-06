import { UserModel } from "../UserStorage/db";
import { getPostgresClient, isPostgresConfigured } from "../storage/postgresClient";
import {
  MEMBER_SOURCE_BADMINTON9,
  MEMBER_SOURCE_PPAMONG,
} from "./memberPlatform";

/** PostgreSQL users.id 목록 (빠던9 레거시 회원) */
export async function fetchPostgresUserIds(): Promise<Set<string>> {
  const sql = getPostgresClient();
  if (!sql) return new Set();

  try {
    const rows = (await sql.unsafe(`SELECT id FROM users`)) as { id: string }[];
    return new Set(rows.map((row) => String(row.id)));
  } catch (error) {
    console.error("[memberDataSource] PostgreSQL user id 조회 실패:", error);
    return new Set();
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * 기동 시 1회 — PG 회원은 badminton9, Mongo 전용(빠몽 가입)은 ppamong.
 * 공지·게시판과 동일하게 dataSource로 관리자 탭을 나눕니다.
 */
export async function syncMemberDataSourceTags(): Promise<{
  badminton9: number;
  ppamong: number;
}> {
  let badminton9 = 0;
  let ppamong = 0;

  if (isPostgresConfigured()) {
    const pgIds = await fetchPostgresUserIds();
    if (pgIds.size > 0) {
      const idList = Array.from(pgIds);
      const batchSize = 500;
      for (let i = 0; i < idList.length; i += batchSize) {
        const batch = idList.slice(i, i + batchSize);
        const result = await UserModel.updateMany(
          { id: { $in: batch }, provider: { $ne: "guest" } },
          { $set: { dataSource: MEMBER_SOURCE_BADMINTON9 } },
        );
        badminton9 += result.modifiedCount ?? 0;
      }
    }
  }

  const ppamongResult = await UserModel.updateMany(
    {
      provider: { $ne: "guest" },
      $or: [{ dataSource: { $exists: false } }, { dataSource: null }, { dataSource: "" }],
    },
    { $set: { dataSource: MEMBER_SOURCE_PPAMONG } },
  );
  ppamong = ppamongResult.modifiedCount ?? 0;

  return { badminton9, ppamong };
}
