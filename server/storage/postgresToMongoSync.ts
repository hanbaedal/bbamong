import postgres from "postgres";
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
} from "../mongodb/models";

/** PostgreSQL → MongoDB 동기화 순서 (FK 의존성) */
interface SyncTableDef {
  pgTable: string;
  label: string;
  model: any;
  /** upsert 시 Mongo 전용 필드 유지 */
  preserveOnUpdate?: string[];
  /** 신규 문서 기본값 */
  insertDefaults?: Record<string, unknown>;
}

const SYNC_TABLES: SyncTableDef[] = [
  { pgTable: "stadiums", label: "경기장", model: StadiumModel },
  { pgTable: "users", label: "회원", model: UserModel, insertDefaults: { provider: "local" } },
  {
    pgTable: "admin_users",
    label: "관리자/운영자",
    model: AdminUserModel,
    preserveOnUpdate: ["operatorSlot", "dailyPasswordPlain", "dailyPasswordDate"],
    insertDefaults: { operatorSlot: null, dailyPasswordPlain: "", dailyPasswordDate: "", logoutAllowed: false },
  },
  {
    pgTable: "matches",
    label: "경기",
    model: MatchModel,
    preserveOnUpdate: ["registrationOrder", "createdAt"],
    insertDefaults: { registrationOrder: null, createdAt: new Date() },
  },
  { pgTable: "attendance_records", label: "출석 기록", model: AttendanceRecordModel },
  { pgTable: "posts", label: "게시글", model: PostModel },
  { pgTable: "ebooks", label: "전자책", model: EbookModel },
  { pgTable: "advertisements", label: "광고", model: AdvertisementModel },
  { pgTable: "waiting_screens", label: "대기 화면", model: WaitingScreenModel },
  { pgTable: "notices", label: "공지사항", model: NoticeModel },
  { pgTable: "terms", label: "약관", model: TermModel },
  { pgTable: "faqs", label: "FAQ", model: FaqModel },
  { pgTable: "inquiries", label: "문의", model: InquiryModel },
  { pgTable: "comments", label: "댓글", model: CommentModel },
  { pgTable: "ebook_purchases", label: "전자책 구매", model: EbookPurchaseModel },
  { pgTable: "point_transactions", label: "포인트 내역", model: PointTransactionModel },
  { pgTable: "predictions", label: "예측", model: PredictionModel },
  { pgTable: "round_statistics", label: "라운드 통계", model: RoundStatisticsModel },
  { pgTable: "ad_view_history", label: "광고 시청 기록", model: AdViewHistoryModel },
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

function mapPgRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [pgKey, value] of Object.entries(row)) {
    if (value === undefined) continue;
    const mongoKey = PG_FIELD_MAP[pgKey] ?? snakeToCamel(pgKey);
    mapped[mongoKey] = value;
  }
  return mapped;
}

function getPostgresClient() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return postgres(url, { max: 1 });
}

export interface SyncTableResult {
  pgTable: string;
  label: string;
  read: number;
  upserted: number;
  modified: number;
  skipped?: boolean;
  error?: string;
}

export interface SyncRunResult {
  startedAt: string;
  finishedAt: string;
  success: boolean;
  tables: SyncTableResult[];
  message?: string;
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

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const docs: Record<string, unknown>[] = [];

    for (const row of chunk) {
      const doc = mapPgRow(row);
      if (doc.id == null) continue;
      docs.push(doc);
    }

    if (docs.length === 0) continue;

    const ids = docs.map((d) => d.id);
    const needsExisting = preserve.size > 0 || !!def.insertDefaults;
    const existingById = new Map<string, Record<string, unknown>>();

    if (needsExisting) {
      const selectFields =
        preserve.size > 0 ? ["id", ...Array.from(preserve)].join(" ") : "id";
      const existingDocs = await def.model
        .find({ id: { $in: ids } })
        .select(selectFields)
        .lean();
      for (const ex of existingDocs) {
        existingById.set(String((ex as { id: string }).id), ex as Record<string, unknown>);
      }
    }

    const ops = docs.map((doc) => {
      const existing = existingById.get(String(doc.id));

      if (existing && preserve.size > 0) {
        for (const key of preserve) {
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
          filter: { id: doc.id },
          update: { $set: doc },
          upsert: true,
        },
      };
    });

    const bulk = await def.model.bulkWrite(ops, { ordered: false });
    result.upserted += bulk.upsertedCount ?? 0;
    result.modified += bulk.modifiedCount ?? 0;
  }

  return result;
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

  try {
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
  } finally {
    await pg.end();
    syncInProgress = false;
  }

  const hasErrors = tables.some((t) => t.error && !t.skipped);
  const finishedAt = new Date().toISOString();
  const scopeLabel =
    defs.length === SYNC_TABLES.length
      ? "PostgreSQL → MongoDB 전체 동기화가 완료되었습니다."
      : `${defs.length}개 테이블을 MongoDB에 저장했습니다.`;

  lastSyncResult = {
    startedAt,
    finishedAt,
    success: !hasErrors,
    tables,
    message: hasErrors ? "일부 테이블 저장에 실패했습니다." : scopeLabel,
  };

  console.log(
    `[PgMongoSync] ${defs.map((d) => d.pgTable).join(",")} upsert=${tables.reduce((s, t) => s + t.upserted, 0)} modified=${tables.reduce((s, t) => s + t.modified, 0)}`,
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
