import type { Express } from "express";
import pgDriver from "postgres";
import { mongoose } from "../UserStorage/db";
import {
  getPostgresConnectionSource,
  getPostgresDatabaseName,
  isPostgresConfigured,
  resolveDatabaseUrl,
} from "../storage/postgresClient";

export async function healthRoutes(app: Express): Promise<void> {
  app.get("/api/health", async (_req, res) => {
    const mongoConnected = mongoose.connection.readyState === 1;

    let postgresql: {
      secretSet: boolean;
      connected: boolean;
      label: string;
      hint: string;
      database?: string | null;
      connectionSource?: "pg-parts" | "database-url";
      sampleCounts?: { users: number | null; stadiums: number | null };
    };

    if (!isPostgresConfigured()) {
      postgresql = {
        secretSet: false,
        connected: false,
        label: "미설정",
        hint: "Replit Secrets에 DATABASE_URL 또는 PGHOST·PGUSER·PGPASSWORD·PGDATABASE(ppadun9)를 추가하세요.",
      };
    } else {
      let pg: ReturnType<typeof pgDriver> | null = null;
      const connectionUrl = resolveDatabaseUrl()!;
      try {
        pg = pgDriver(connectionUrl, {
          max: 1,
          connect_timeout: 8,
        });
        await pg`SELECT 1`;
        const database = await getPostgresDatabaseName(pg);
        let users: number | null = null;
        let stadiums: number | null = null;
        try {
          const u = await pg`SELECT COUNT(*)::int AS n FROM users`;
          users = u[0]?.n ?? 0;
        } catch {
          users = null;
        }
        try {
          const s = await pg`SELECT COUNT(*)::int AS n FROM stadiums`;
          stadiums = s[0]?.n ?? 0;
        } catch {
          stadiums = null;
        }
        postgresql = {
          secretSet: true,
          connected: true,
          label: "연결됨",
          hint:
            users === 0 && stadiums === 0
              ? `DB「${database ?? "?"}」에 users/stadiums 데이터가 0건입니다. 빠던9 Replit의 PGHOST·PGDATABASE(ppadun9)를 확인하세요.`
              : "디비 백업하기에서 「받기」를 사용할 수 있습니다.",
          database,
          connectionSource: getPostgresConnectionSource() ?? undefined,
          sampleCounts: { users, stadiums },
        };
      } catch {
        postgresql = {
          secretSet: true,
          connected: false,
          label: "설정됐지만 연결 실패",
          hint: "DATABASE_URL의 사용자·비밀번호·호스트·sslmode=require 를 확인하세요. 비밀번호 특수문자는 URL 인코딩이 필요합니다.",
        };
      } finally {
        if (pg) await pg.end({ timeout: 2 }).catch(() => {});
      }
    }

    res.json({
      ok: mongoConnected,
      service: "ppamong",
      checkedAt: new Date().toISOString(),
      mongodb: {
        label: mongoConnected ? "연결됨" : "오류",
        ok: mongoConnected,
        hint: mongoConnected
          ? "운영 DB(MONGODB_URI)는 정상입니다."
          : "MONGODB_URI를 Replit Secrets에서 확인하세요.",
      },
      postgresql,
      summary:
        mongoConnected && postgresql.connected
          ? "모든 DB 설정이 정상입니다."
          : mongoConnected && !postgresql.secretSet
            ? "서비스는 정상입니다. 공통 PostgreSQL(DATABASE_URL)만 아직 없습니다 — 「받기」 기능만 사용 불가."
            : mongoConnected && postgresql.secretSet && !postgresql.connected
              ? "서비스는 정상이나 DATABASE_URL 연결이 실패했습니다. URI·비밀번호를 확인하세요."
              : "MongoDB 연결에 문제가 있습니다.",
    });
  });
}
