import type postgres from "postgres";
import { getPostgresClient, getPostgresDatabaseName } from "./postgresClient";
import {
  UserModel,
  AdminUserModel,
  StadiumModel,
  MatchModel,
  AttendanceRecordModel,
  PostModel,
  CommentModel,
  PointTransactionModel,
  InquiryModel,
  NoticeModel,
  TermModel,
  FaqModel,
  EbookModel,
  EbookPurchaseModel,
  PredictionModel,
  RoundStatisticsModel,
  WaitingScreenModel,
  AdvertisementModel,
  AdViewHistoryModel,
  CounterModel,
} from "../mongodb/models";

/** PostgreSQL → MongoDB 동기화 순서 (FK 의존성) */
interface SyncTableDef {
  pgTable: string;
  label: string;
  model: any;
  /** upsert 필터 키 (기본 id) */
  upsertKey?: string;
  /** upsert 시 Mongo 전용 필드 유지 */
  preserveOnUpdate?: string[];
  /** 신규 문서 기본값 */
  insertDefaults?: Record<string, unknown>;
  /** 동기화 후 Mongo 시퀀스 카운터 이름 */
  counterName?: string;
}

const SYNC_TABLES: SyncTableDef[] = [
  { pgTable: "stadiums", label: "경기장", model: StadiumModel, counterName: "stadium" },
  { pgTable: "users", label: "회원", model: UserModel, insertDefaults: { provider: "local" } },
  {
    pgTable: "admin_users",
    label: "관리자/운영자",
    model: AdminUserModel,
    preserveOnUpdate: ["operatorSlot", "dailyPasswordPlain", "dailyPasswordDate", "passwordPlain"],
    insertDefaults: { operatorSlot: null, dailyPasswordPlain: "", dailyPasswordDate: "", logoutAllowed: false },
  },
  {
    pgTable: "matches",
    label: "경기",
    model: MatchModel,
    preserveOnUpdate: ["registrationOrder", "createdAt"],
    insertDefaults: { registrationOrder: null, createdAt: new Date() },
  },
  {
    pgTable: "attendance_records",
    label: "출석 기록",
    model: AttendanceRecordModel,
    counterName: "attendanceRecord",
  },
  { pgTable: "posts", label: "게시글", model: PostModel, counterName: "post" },
  { pgTable: "ebooks", label: "전자책", model: EbookModel, counterName: "ebook" },
  {
    pgTable: "advertisements",
    label: "광고",
    model: AdvertisementModel,
    counterName: "advertisement",
  },
  {
    pgTable: "waiting_screens",
    label: "대기 화면",
    model: WaitingScreenModel,
    counterName: "waitingScreen",
  },
  { pgTable: "notices", label: "공지사항", model: NoticeModel, counterName: "notice" },
  { pgTable: "terms", label: "약관", model: TermModel, counterName: "term" },
  { pgTable: "faqs", label: "FAQ", model: FaqModel, counterName: "faq" },
  { pgTable: "inquiries", label: "문의", model: InquiryModel, counterName: "inquiry" },
  { pgTable: "comments", label: "댓글", model: CommentModel, counterName: "comment" },
  {
    pgTable: "ebook_purchases",
    label: "전자책 구매",
    model: EbookPurchaseModel,
    counterName: "ebookPurchase",
  },
  {
    pgTable: "point_transactions",
    label: "포인트 내역",
    model: PointTransactionModel,
    counterName: "pointTransaction",
  },
  { pgTable: "predictions", label: "예측", model: PredictionModel, counterName: "prediction" },
  {
    pgTable: "round_statistics",
    label: "라운드 통계",
    model: RoundStatisticsModel,
    counterName: "roundStatistics",
  },
  {
    pgTable: "ad_view_history",
    label: "광고 시청 기록",
    model: AdViewHistoryModel,
    counterName: "adViewHistory",
  },
  { pgTable: "counters", label: "시퀀스 카운터", model: CounterModel, upsertKey: "name" },
];

const PG_FIELD_MAP: Record<string, string> = {
  last_login_at: "lastLogin",
  last_logout_at: "lastLogout",
  last_active_at: "lastActive",
  last_login: "lastLogin",
  last_logout: "lastLogout",
  provider_id: "providerId",
  invite_code: "inviteCode",
  referral_code: "referralCode",
  verification_code: "verificationCode",
  verification_code_expiry: "verificationCodeExpiry",
  last_attendance_date: "lastAttendanceDate",
  is_suspended: "isSuspended",
  suspended_at: "suspendedAt",
  created_at: "createdAt",
  is_online: "isOnline",
  total_donation_amount: "totalDonationAmount",
  user_type: "userType",
  approval_status: "approvalStatus",
  assigned_match_number: "assignedMatchNumber",
  logout_allowed: "logoutAllowed",
  stadium_id: "stadiumId",
  match_date: "matchDate",
  start_time: "startTime",
  end_time: "endTime",
  match_status: "matchStatus",
  current_round: "currentRound",
  prediction_enabled: "predictionEnabled",
  user_id: "userId",
  attendance_date: "attendanceDate",
  author_id: "authorId",
  view_count: "viewCount",
  post_id: "postId",
  transaction_type: "transactionType",
  display_order: "displayOrder",
  updated_at: "updatedAt",
  ebook_id: "ebookId",
  purchased_at: "purchasedAt",
  match_id: "matchId",
  round_number: "roundNumber",
  won_amount: "wonAmount",
  donated_amount: "donatedAmount",
  total_participants: "totalParticipants",
  total_points: "totalPoints",
  total_winners: "totalWinners",
  prediction_start_time: "predictionStartTime",
  prediction_stop_time: "predictionStopTime",
  is_prediction_started: "isPredictionStarted",
  is_prediction_stopped: "isPredictionStopped",
  is_result_sent: "isResultSent",
  video_name: "videoName",
  display_duration: "displayDuration",
  video_url: "videoUrl",
  earned_points: "earnedPoints",
  advertisement_id: "advertisementId",
  viewed_at: "viewedAt",
};

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function normalizePgValue(value: unknown, mongoKey: string): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) {
    if (mongoKey === "matchDate") return formatDateOnly(value);
    return value;
  }
  if (typeof value === "string" && mongoKey === "matchDate" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  if (
    typeof value === "string" &&
    /^(true|false)$/i.test(value) &&
    (mongoKey.startsWith("is") || mongoKey === "predictionEnabled" || mongoKey === "logoutAllowed")
  ) {
    return value.toLowerCase() === "true";
  }
  if (typeof value === "number" && (mongoKey.startsWith("is") && mongoKey !== "isSuspended" && mongoKey !== "isOnline")) {
    return value !== 0;
  }
  return value;
}

function mapPgRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [pgKey, value] of Object.entries(row)) {
    if (value === undefined) continue;
    const mongoKey = PG_FIELD_MAP[pgKey] ?? snakeToCamel(pgKey);
    mapped[mongoKey] = normalizePgValue(value, mongoKey);
  }
  return mapped;
}

function bulkWriteErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "writeErrors" in error) {
    const writeErrors = (error as { writeErrors?: { errmsg?: string }[] }).writeErrors;
    const first = writeErrors?.[0]?.errmsg;
    if (first) return first;
  }
  return error instanceof Error ? error.message : String(error);
}

export interface SyncTableResult {
  pgTable: string;
  label: string;
  read: number;
  upserted: number;
  modified: number;
  droppedNoId?: number;
  skipped?: boolean;
  error?: string;
}

export interface SyncRunResult {
  startedAt: string;
  finishedAt: string;
  success: boolean;
  tables: SyncTableResult[];
  message?: string;
  pgDatabase?: string | null;
  totalRead?: number;
  totalWritten?: number;
  countParity?: CountParityRow[];
}

export interface CountParityRow {
  pgTable: string;
  label: string;
  postgresCount: number;
  mongoCount: number;
  match: boolean;
}

let lastSyncResult: SyncRunResult | null = null;
let syncInProgress = false;

export function getLastPostgresMongoSyncResult(): SyncRunResult | null {
  return lastSyncResult;
}

export function isPostgresMongoSyncRunning(): boolean {
  return syncInProgress;
}

async function syncTable(
  pg: postgres.Sql,
  def: SyncTableDef,
): Promise<SyncTableResult> {
  const result: SyncTableResult = {
    pgTable: def.pgTable,
    label: def.label,
    read: 0,
    upserted: 0,
    modified: 0,
  };

  const upsertKey = def.upsertKey ?? "id";

  let rows: Record<string, unknown>[];
  try {
    rows = (await pg.unsafe(`SELECT * FROM "${def.pgTable}"`)) as Record<string, unknown>[];
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("does not exist")) {
      result.skipped = true;
      result.error = "PostgreSQL 테이블 없음";
      return result;
    }
    throw error;
  }

  result.read = rows.length;
  if (rows.length === 0) return result;

  const preserve = new Set(def.preserveOnUpdate ?? []);
  const CHUNK = 200;
  let droppedNoKey = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const docs: Record<string, unknown>[] = [];

    for (const row of chunk) {
      const doc = mapPgRow(row);
      const keyVal = doc[upsertKey];
      if (keyVal == null || keyVal === "") {
        droppedNoKey += 1;
        continue;
      }
      docs.push(doc);
    }

    if (docs.length === 0) continue;

    const keyValues = docs.map((d) => d[upsertKey]);
    const needsExisting = preserve.size > 0 || !!def.insertDefaults;
    const existingByKey = new Map<string, Record<string, unknown>>();

    if (needsExisting) {
      const selectFields =
        preserve.size > 0 ? [upsertKey, ...Array.from(preserve)].join(" ") : upsertKey;
      const existingDocs = await def.model
        .find({ [upsertKey]: { $in: keyValues } })
        .select(selectFields)
        .lean();
      for (const ex of existingDocs) {
        existingByKey.set(String((ex as Record<string, unknown>)[upsertKey]), ex as Record<string, unknown>);
      }
    }

    const ops = docs.map((doc) => {
      const existing = existingByKey.get(String(doc[upsertKey]));

      if (existing && preserve.size > 0) {
        for (const key of Array.from(preserve)) {
          const val = existing[key];
          if (val !== undefined && val !== null && val !== "") {
            doc[key] = val;
          }
        }
      } else if (!existing && def.insertDefaults) {
        Object.assign(doc, def.insertDefaults);
      }

      return {
        updateOne: {
          filter: { [upsertKey]: doc[upsertKey] },
          update: { $set: doc },
          upsert: true,
        },
      };
    });

    try {
      const bulk = await def.model.bulkWrite(ops, {
        ordered: false,
        bypassDocumentValidation: true,
      });
      result.upserted += bulk.upsertedCount ?? 0;
      result.modified += bulk.modifiedCount ?? 0;
    } catch (error: unknown) {
      throw new Error(bulkWriteErrorMessage(error));
    }
  }

  if (droppedNoKey > 0) {
    result.droppedNoId = droppedNoKey;
    if (result.upserted === 0 && result.modified === 0) {
      result.error = `${upsertKey} 없는 행 ${droppedNoKey}건 — MongoDB에 저장하지 못했습니다.`;
    }
  }

  return result;
}

/** PG와 동일한 시퀀스 값을 Mongo counters에 반영 */
async function rebuildMongoCounters(defs: SyncTableDef[]): Promise<void> {
  for (const def of defs) {
    if (!def.counterName) continue;
    const latest = await def.model.findOne().sort({ id: -1 }).select("id").lean();
    const maxId = (latest as { id?: number } | null)?.id;
    if (typeof maxId !== "number" || maxId < 1) continue;
    await CounterModel.updateOne(
      { name: def.counterName },
      { $set: { name: def.counterName, value: maxId } },
      { upsert: true },
    );
  }
}

async function buildCountParity(
  pg: postgres.Sql,
  defs: SyncTableDef[],
): Promise<CountParityRow[]> {
  const rows: CountParityRow[] = [];
  for (const def of defs) {
    let postgresCount = 0;
    try {
      const countRows = await pg.unsafe(
        `SELECT COUNT(*)::int AS count FROM "${def.pgTable}"`,
      );
      postgresCount = (countRows[0] as { count?: number })?.count ?? 0;
    } catch {
      continue;
    }
    const mongoCount = await def.model.countDocuments();
    rows.push({
      pgTable: def.pgTable,
      label: def.label,
      postgresCount,
      mongoCount,
      match: postgresCount === mongoCount,
    });
  }
  return rows;
}

export function getSyncablePgTables(): string[] {
  return SYNC_TABLES.map((t) => t.pgTable);
}

function resolveSyncDefs(pgTables?: string[]): SyncTableDef[] {
  if (!pgTables || pgTables.length === 0) {
    return SYNC_TABLES;
  }
  const allowed = new Set(pgTables);
  const defs = SYNC_TABLES.filter((t) => allowed.has(t.pgTable));
  if (defs.length === 0) {
    throw new Error("동기화할 수 있는 테이블이 없습니다.");
  }
  const unknown = pgTables.filter((t) => !SYNC_TABLES.some((d) => d.pgTable === t));
  if (unknown.length > 0) {
    throw new Error(`동기화 미지원 테이블: ${unknown.join(", ")}`);
  }
  return defs;
}

async function runSync(defs: SyncTableDef[]): Promise<SyncRunResult> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다.");
  }
  if (syncInProgress) {
    throw new Error("동기화가 이미 실행 중입니다.");
  }

  syncInProgress = true;
  const startedAt = new Date().toISOString();
  const tables: SyncTableResult[] = [];

  const pg = getPostgresClient();
  if (!pg) {
    syncInProgress = false;
    throw new Error("PostgreSQL 연결을 열 수 없습니다.");
  }

  let pgDatabase: string | null = null;
  let countParity: CountParityRow[] = [];

  try {
    pgDatabase = await getPostgresDatabaseName(pg);
    console.log(`[PgMongoSync] PostgreSQL database=${pgDatabase ?? "?"}`);

    for (const def of defs) {
      try {
        tables.push(await syncTable(pg, def));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        tables.push({
          pgTable: def.pgTable,
          label: def.label,
          read: 0,
          upserted: 0,
          modified: 0,
          error: message,
        });
      }
    }

    if (!tables.some((t) => t.error && !t.skipped)) {
      await rebuildMongoCounters(defs);
      countParity = await buildCountParity(pg, defs);
    }
  } finally {
    await pg.end();
    syncInProgress = false;
  }

  const totalRead = tables.reduce((s, t) => s + t.read, 0);
  const totalWritten = tables.reduce((s, t) => s + t.upserted + t.modified, 0);
  const hasErrors = tables.some((t) => t.error && !t.skipped);
  const finishedAt = new Date().toISOString();
  const scopeLabel =
    defs.length === SYNC_TABLES.length
      ? "PostgreSQL → MongoDB 전체 동기화가 완료되었습니다."
      : `${defs.length}개 테이블을 MongoDB에 저장했습니다.`;

  let success = !hasErrors;
  let message = hasErrors ? "일부 테이블 저장에 실패했습니다." : scopeLabel;

  if (!hasErrors && totalRead === 0) {
    success = false;
    message =
      pgDatabase != null
        ? `PostgreSQL DB「${pgDatabase}」에서 읽은 데이터가 0건입니다. DATABASE_URL의 DB 이름(예: ppadun9)이 맞는지 Neon에서 확인하세요.`
        : "PostgreSQL에서 읽은 데이터가 0건입니다. DATABASE_URL의 DB 이름이 맞는지 확인하세요.";
  } else if (!hasErrors && totalRead > 0 && totalWritten === 0) {
    success = false;
    message =
      `PostgreSQL에서 ${totalRead}건을 읽었으나 MongoDB에 저장된 건이 0입니다. id 컬럼·스키마 검증 오류를 확인하세요.`;
  } else if (!hasErrors && totalWritten > 0) {
    const mismatched = countParity.filter((r) => !r.match && r.postgresCount > 0);
    message = `${scopeLabel} (읽음 ${totalRead}건, 신규 ${tables.reduce((s, t) => s + t.upserted, 0)}, 갱신 ${tables.reduce((s, t) => s + t.modified, 0)})`;
    if (mismatched.length > 0) {
      message += ` — 건수 불일치: ${mismatched.map((r) => r.pgTable).join(", ")}`;
    }
  }

  lastSyncResult = {
    startedAt,
    finishedAt,
    success,
    tables,
    message,
    pgDatabase,
    totalRead,
    totalWritten,
    countParity,
  };

  console.log(
    `[PgMongoSync] db=${pgDatabase ?? "?"} read=${totalRead} upsert=${tables.reduce((s, t) => s + t.upserted, 0)} modified=${tables.reduce((s, t) => s + t.modified, 0)} success=${success}`,
  );

  return lastSyncResult;
}

/** PostgreSQL(읽기 전용) → MongoDB upsert — 단일 테이블 */
export async function syncPostgresTableToMongo(pgTable: string): Promise<SyncRunResult> {
  return runSync(resolveSyncDefs([pgTable]));
}

/** PostgreSQL(읽기 전용) → MongoDB upsert — 선택 테이블 (FK 순서 유지) */
export async function syncPostgresTablesToMongo(pgTables: string[]): Promise<SyncRunResult> {
  return runSync(resolveSyncDefs(pgTables));
}

/** PostgreSQL(읽기 전용) → MongoDB upsert — 전체 테이블 */
export async function syncPostgresToMongo(): Promise<SyncRunResult> {
  return runSync(SYNC_TABLES);
}
