import {
  getPostgresClient,
} from "./postgresClient";
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
import { hasActiveSession } from "../sessionManager";
import {
  BADMINTON9_MANAGER_MONGO_FILTER,
  PPAMONG_MANAGER_MONGO_FILTER,
  resolveManagerPlatform,
} from "../utils/managerPlatform";
import {
  BADMINTON9_ADMIN_MONGO_FILTER,
  PPAMONG_ADMIN_MONGO_FILTER,
  resolveAdminPlatform,
  type AdminPlatform,
} from "../utils/staffUsername";

export interface BackupTableInfo {
  pgTable: string;
  label: string;
  mongoCount: number;
  postgresAvailable: boolean;
  postgresCount: number | null;
}

interface TableDef {
  pgTable: string;
  label: string;
  model: any;
}

const BACKUP_TABLES: TableDef[] = [
  { pgTable: "users", label: "회원", model: UserModel },
  { pgTable: "admin_users", label: "관리자/운영자", model: AdminUserModel },
  { pgTable: "stadiums", label: "경기장", model: StadiumModel },
  { pgTable: "matches", label: "경기", model: MatchModel },
  { pgTable: "attendance_records", label: "출석 기록", model: AttendanceRecordModel },
  { pgTable: "posts", label: "게시글", model: PostModel },
  { pgTable: "comments", label: "댓글", model: CommentModel },
  { pgTable: "point_transactions", label: "포인트 내역", model: PointTransactionModel },
  { pgTable: "inquiries", label: "문의", model: InquiryModel },
  { pgTable: "notices", label: "공지사항", model: NoticeModel },
  { pgTable: "terms", label: "약관", model: TermModel },
  { pgTable: "faqs", label: "FAQ", model: FaqModel },
  { pgTable: "ebooks", label: "전자책", model: EbookModel },
  { pgTable: "ebook_purchases", label: "전자책 구매", model: EbookPurchaseModel },
  { pgTable: "predictions", label: "예측", model: PredictionModel },
  { pgTable: "round_statistics", label: "라운드 통계", model: RoundStatisticsModel },
  { pgTable: "waiting_screens", label: "대기 화면", model: WaitingScreenModel },
  { pgTable: "advertisements", label: "광고", model: AdvertisementModel },
  { pgTable: "ad_view_history", label: "광고 시청 기록", model: AdViewHistoryModel },
  { pgTable: "counters", label: "시퀀스 카운터", model: CounterModel },
];

const ALLOWED_PG_TABLES = new Set(BACKUP_TABLES.map((t) => t.pgTable));

export interface LoginStatusRow {
  id: string;
  username: string;
  name: string;
  status: "온라인" | "오프라인";
  lastLogin: Date | null;
  lastLogout: Date | null;
  sessionDuration: string;
  userType?: string;
  department?: string | null;
  position?: string | null;
  assignedMatchNumber?: string | null;
  platform: AdminPlatform;
}

export interface LoginStatusResponse {
  rows: LoginStatusRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  platform: AdminPlatform;
  counts: { ppamong: number; badminton9: number };
}

function formatDuration(milliseconds: number): string {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  return `${String(hours).padStart(2, "0")}시간 ${String(minutes).padStart(2, "0")}분`;
}

async function buildSessionDuration(
  lastLogin: Date | null,
  lastLogout: Date | null,
  isOnline: boolean,
): Promise<string> {
  if (!lastLogin) return "--";
  if (isOnline) {
    return formatDuration(Date.now() - lastLogin.getTime());
  }
  if (lastLogout && lastLogout.getTime() > lastLogin.getTime()) {
    return formatDuration(lastLogout.getTime() - lastLogin.getTime());
  }
  return "--";
}

function getPostgresClientForOps() {
  return getPostgresClient();
}

export class SuperAdminOpsStorage {
  async listBackupTables(): Promise<BackupTableInfo[]> {
    const pg = getPostgresClientForOps();

    const results = await Promise.all(
      BACKUP_TABLES.map(async (table) => {
        const mongoCount = await table.model.countDocuments();
        let postgresCount: number | null = null;

        if (pg) {
          try {
            const rows = await pg.unsafe(
              `SELECT COUNT(*)::int AS count FROM "${table.pgTable}"`,
            );
            postgresCount = rows[0]?.count ?? 0;
          } catch {
            postgresCount = null;
          }
        }

        return {
          pgTable: table.pgTable,
          label: table.label,
          mongoCount,
          postgresAvailable: !!pg,
          postgresCount,
        };
      }),
    );

    if (pg) await pg.end();
    return results;
  }

  async exportMongoTable(pgTable: string) {
    if (!ALLOWED_PG_TABLES.has(pgTable)) {
      throw new Error("허용되지 않은 테이블입니다.");
    }
    const def = BACKUP_TABLES.find((t) => t.pgTable === pgTable)!;
    const documents = await (def.model as any).find({}).lean();
    return {
      source: "mongodb" as const,
      pgTable,
      label: def.label,
      exportedAt: new Date().toISOString(),
      count: documents.length,
      data: documents,
    };
  }

  async exportPostgresTable(pgTable: string) {
    if (!ALLOWED_PG_TABLES.has(pgTable)) {
      throw new Error("허용되지 않은 테이블입니다.");
    }
    const pg = getPostgresClientForOps();
    if (!pg) {
      throw new Error("PostgreSQL(DATABASE_URL)이 설정되지 않았습니다.");
    }

    try {
      const rows = await pg.unsafe(`SELECT * FROM "${pgTable}"`);
      const def = BACKUP_TABLES.find((t) => t.pgTable === pgTable)!;
      return {
        source: "postgresql" as const,
        pgTable,
        label: def.label,
        exportedAt: new Date().toISOString(),
        count: rows.length,
        data: rows,
      };
    } finally {
      await pg.end();
    }
  }

  async getAdminLoginStatus(
    page = 1,
    limit = 8,
    platform: AdminPlatform = "ppamong",
  ): Promise<LoginStatusResponse> {
    const filter = platform === "ppamong" ? PPAMONG_ADMIN_MONGO_FILTER : BADMINTON9_ADMIN_MONGO_FILTER;
    const [total, ppamongCount, badminton9Count] = await Promise.all([
      AdminUserModel.countDocuments(filter),
      AdminUserModel.countDocuments(PPAMONG_ADMIN_MONGO_FILTER),
      AdminUserModel.countDocuments(BADMINTON9_ADMIN_MONGO_FILTER),
    ]);
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const admins = await AdminUserModel.find(filter)
      .select("id username name lastLogin lastLogout userType department position")
      .sort({ lastLogin: -1, id: 1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const rows: LoginStatusRow[] = await Promise.all(
      admins.map(async (admin) => {
        const isOnline = await hasActiveSession("admin", admin.id);
        return {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          userType: admin.userType,
          department: admin.department ?? null,
          position: admin.position ?? null,
          platform: resolveAdminPlatform(admin.username, admin.userType),
          status: isOnline ? "온라인" : "오프라인",
          lastLogin: admin.lastLogin ?? null,
          lastLogout: admin.lastLogout ?? null,
          sessionDuration: await buildSessionDuration(
            admin.lastLogin ?? null,
            admin.lastLogout ?? null,
            isOnline,
          ),
        };
      }),
    );

    return {
      rows,
      total,
      page,
      limit,
      totalPages,
      platform,
      counts: { ppamong: ppamongCount, badminton9: badminton9Count },
    };
  }

  async getManagerLoginStatus(
    page = 1,
    limit = 8,
    platform: AdminPlatform = "ppamong",
  ): Promise<LoginStatusResponse> {
    const filter = platform === "ppamong" ? PPAMONG_MANAGER_MONGO_FILTER : BADMINTON9_MANAGER_MONGO_FILTER;
    const [total, ppamongCount, badminton9Count] = await Promise.all([
      AdminUserModel.countDocuments(filter),
      AdminUserModel.countDocuments(PPAMONG_MANAGER_MONGO_FILTER),
      AdminUserModel.countDocuments(BADMINTON9_MANAGER_MONGO_FILTER),
    ]);
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const managers = await AdminUserModel.find(filter)
      .select("id username name lastLogin lastLogout userType assignedMatchNumber department position")
      .sort({ lastLogin: -1, id: 1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const rows: LoginStatusRow[] = await Promise.all(
      managers.map(async (manager) => {
        const isOnline = await hasActiveSession("manager", manager.id);
        return {
          id: manager.id,
          username: manager.username,
          name: manager.name,
          userType: manager.userType,
          department: manager.department ?? null,
          position: manager.position ?? null,
          assignedMatchNumber: manager.assignedMatchNumber ?? null,
          platform: resolveManagerPlatform(manager.username),
          status: isOnline ? "온라인" : "오프라인",
          lastLogin: manager.lastLogin ?? null,
          lastLogout: manager.lastLogout ?? null,
          sessionDuration: await buildSessionDuration(
            manager.lastLogin ?? null,
            manager.lastLogout ?? null,
            isOnline,
          ),
        };
      }),
    );

    return {
      rows,
      total,
      page,
      limit,
      totalPages,
      platform,
      counts: { ppamong: ppamongCount, badminton9: badminton9Count },
    };
  }

  async forceManagerLogout(managerId: string): Promise<void> {
    const { deleteSession, grantLogoutPermission } = await import("../sessionManager");
    await deleteSession("manager", managerId);
    await grantLogoutPermission("manager", managerId);
  }

  async forceAdminLogout(adminId: string): Promise<void> {
    const { deleteSession, grantLogoutPermission } = await import("../sessionManager");
    await deleteSession("admin", adminId);
    await grantLogoutPermission("admin", adminId);
  }
}

export const superAdminOpsStorage = new SuperAdminOpsStorage();
