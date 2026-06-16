import type { Express } from "express";
import postgres from "postgres";
import { mongoose } from "../UserStorage/db";

export async function healthRoutes(app: Express): Promise<void> {
  app.get("/api/health", async (_req, res) => {
    const mongoConnected = mongoose.connection.readyState === 1;

    let postgres: {
      secretSet: boolean;
      connected: boolean;
      label: string;
      hint: string;
    };

    if (!process.env.DATABASE_URL?.trim()) {
      postgres = {
        secretSet: false,
        connected: false,
        label: "미설정",
        hint: "Replit Secrets에 DATABASE_URL(전체 postgresql:// URI)을 추가한 뒤 Repl을 재시작하세요.",
      };
    } else {
      let pg: ReturnType<typeof postgres> | null = null;
      try {
        pg = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 8 });
        await pg`SELECT 1`;
        postgres = {
          secretSet: true,
          connected: true,
          label: "연결됨",
          hint: "디비 백업하기에서 「받기」를 사용할 수 있습니다.",
        };
      } catch {
        postgres = {
          secretSet: true,
          connected: false,
          label: "설정됐지만 연결 실패",
          hint: "DATABASE_URL의 사용자·비밀번호·호스트가 맞는지 확인하세요. 비밀번호 특수문자는 URL 인코딩이 필요합니다.",
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
      postgresql: postgres,
      summary:
        mongoConnected && postgres.connected
          ? "모든 DB 설정이 정상입니다."
          : mongoConnected && !postgres.secretSet
            ? "서비스는 정상입니다. 공통 PostgreSQL(DATABASE_URL)만 아직 없습니다 — 「받기」 기능만 사용 불가."
            : mongoConnected && postgres.secretSet && !postgres.connected
              ? "서비스는 정상이나 DATABASE_URL 연결이 실패했습니다. URI·비밀번호를 확인하세요."
              : "MongoDB 연결에 문제가 있습니다.",
    });
  });
}
