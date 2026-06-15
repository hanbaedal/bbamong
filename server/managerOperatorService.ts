import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { AdminUserModel, MatchModel, StadiumModel } from "./UserStorage/db";
import { deleteSession } from "./sessionManager";
import { getKstDateString } from "./utils/dateUtils";

export const OPERATOR_USERNAMES = ["op1", "op2", "op3", "op4", "op5"] as const;
const OPERATOR_COUNT = 5;
const PASSWORD_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function getKstDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function generateDailyPassword(length = 8): string {
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += PASSWORD_CHARSET[bytes[i]! % PASSWORD_CHARSET.length];
  }
  return result;
}

function todayRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today, tomorrow };
}

function todayMatchFilter() {
  const kstToday = getKstDateString();
  const { today, tomorrow } = todayRange();
  return {
    $or: [
      { matchDate: kstToday },
      { matchDate: null, startTime: { $gte: today, $lt: tomorrow } },
    ],
  };
}

export interface OrderedTodayMatch {
  id: string;
  name: string;
  startTime: Date;
  stadiumName: string;
  registrationOrder: number;
}

export async function getTodayMatchesByRegistrationOrder(): Promise<OrderedTodayMatch[]> {
  const docs = await MatchModel.find(todayMatchFilter())
    .sort({ registrationOrder: 1, createdAt: 1, _id: 1 })
    .limit(OPERATOR_COUNT)
    .lean();

  const result: OrderedTodayMatch[] = [];
  for (let i = 0; i < docs.length; i++) {
    const row = docs[i]!;
    const stadium = await StadiumModel.findOne({ id: row.stadiumId }).select("name").lean();
    result.push({
      id: row.id,
      name: row.name,
      startTime: row.startTime,
      stadiumName: stadium?.name ?? "",
      registrationOrder: (row as { registrationOrder?: number }).registrationOrder ?? i + 1,
    });
  }
  return result;
}

async function applyDailyPasswordIfNeeded(
  managerId: string,
  currentDate: string | null | undefined,
  today: string,
): Promise<{ plain?: string; rotated: boolean }> {
  if (currentDate === today) {
    return { rotated: false };
  }
  const plain = generateDailyPassword();
  const hash = await bcrypt.hash(plain, 10);
  await AdminUserModel.updateOne(
    { id: managerId },
    { password: hash, dailyPasswordPlain: plain, dailyPasswordDate: today },
  );
  try {
    await deleteSession("manager", managerId);
  } catch {
    /* 세션 없음 */
  }
  return { plain, rotated: true };
}

/** 오늘 경기 등록 순서 1~5 → op1~op5 자동 할당 */
export async function syncOperatorMatchAssignments(): Promise<void> {
  const matches = await getTodayMatchesByRegistrationOrder();

  for (let slot = 1; slot <= OPERATOR_COUNT; slot++) {
    const match = matches[slot - 1];
    const username = `op${slot}`;
    if (match) {
      await AdminUserModel.updateOne(
        { username, userType: "매니저" },
        {
          assignedMatchNumber: match.name,
          name: `${match.name} 운영자`,
        },
      );
    } else {
      await AdminUserModel.updateOne(
        { username, userType: "매니저" },
        {
          assignedMatchNumber: null,
          name: `${slot}번 운영자 (경기 미등록)`,
        },
      );
    }
  }
}

export async function ensureOperatorsReady(): Promise<void> {
  const today = getKstDateKey();

  for (let slot = 1; slot <= OPERATOR_COUNT; slot++) {
    const username = `op${slot}`;
    const existing = await AdminUserModel.findOne({ username }).lean();

    if (!existing) {
      const plain = generateDailyPassword();
      const hash = await bcrypt.hash(plain, 10);
      await AdminUserModel.create({
        id: randomUUID(),
        username,
        email: `${username}@operators.ppamong.local`,
        name: `${slot}번 운영자`,
        password: hash,
        phone: `010000000${slot}0`,
        department: "현장운영",
        position: "운영자",
        userType: "매니저",
        approvalStatus: "승인",
        status: "활성화",
        assignedMatchNumber: null,
        operatorSlot: slot,
        dailyPasswordPlain: plain,
        dailyPasswordDate: today,
      });
      console.log(`[Operators] 계정 생성: ${username}`);
      continue;
    }

    const updates: Record<string, unknown> = {
      userType: "매니저",
      approvalStatus: "승인",
      operatorSlot: slot,
    };

    if (existing.dailyPasswordDate !== today) {
      const plain = generateDailyPassword();
      updates.password = await bcrypt.hash(plain, 10);
      updates.dailyPasswordPlain = plain;
      updates.dailyPasswordDate = today;
    }

    await AdminUserModel.updateOne({ id: existing.id }, updates);
  }

  await syncOperatorMatchAssignments();
}

export interface OperatorAccountView {
  id: string;
  username: string;
  name: string;
  assignedMatchNumber: string | null;
  assignedMatchDetail: string | null;
  assignmentLabel: string;
  status: string;
  dailyPasswordPlain: string;
  dailyPasswordDate: string;
  lastLogin: Date | null;
  operatorSlot: number;
}

export async function listOperatorAccounts(): Promise<{
  operators: OperatorAccountView[];
  todayMatches: OrderedTodayMatch[];
}> {
  await ensureOperatorsReady();

  const todayMatches = await getTodayMatchesByRegistrationOrder();

  const docs = await AdminUserModel.find({
    username: { $in: [...OPERATOR_USERNAMES] },
    userType: "매니저",
  })
    .select(
      "id username name assignedMatchNumber status dailyPasswordPlain dailyPasswordDate lastLogin operatorSlot",
    )
    .sort({ operatorSlot: 1 })
    .lean();

  const today = getKstDateKey();
  const operators: OperatorAccountView[] = [];

  for (const doc of docs) {
    const slot = (doc as { operatorSlot?: number }).operatorSlot ?? 0;
    let plain = (doc as { dailyPasswordPlain?: string }).dailyPasswordPlain ?? "";
    const dateKey = (doc as { dailyPasswordDate?: string }).dailyPasswordDate;

    if (dateKey !== today || !plain) {
      const rotated = await applyDailyPasswordIfNeeded(doc.id, dateKey, today);
      plain = rotated.plain ?? plain;
      if (!plain) {
        const refreshed = await AdminUserModel.findOne({ id: doc.id })
          .select("dailyPasswordPlain")
          .lean();
        plain = (refreshed as { dailyPasswordPlain?: string })?.dailyPasswordPlain ?? "";
      }
    }

    const match = todayMatches[slot - 1];
    const assignmentLabel = match
      ? `등록순 ${slot} → ${doc.username} · ${match.name}`
      : `등록순 ${slot} → ${doc.username} · (오늘 경기 없음)`;

    const assignedMatchDetail = match
      ? `${match.stadiumName} · ${new Date(match.startTime).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
      : null;

    operators.push({
      id: doc.id,
      username: doc.username,
      name: doc.name,
      assignedMatchNumber: doc.assignedMatchNumber ?? null,
      assignedMatchDetail,
      assignmentLabel,
      status: doc.status,
      dailyPasswordPlain: plain,
      dailyPasswordDate: today,
      lastLogin: doc.lastLogin ?? null,
      operatorSlot: slot,
    });
  }

  return {
    operators: operators.sort((a, b) => a.operatorSlot - b.operatorSlot),
    todayMatches,
  };
}

export async function setOperatorStatus(
  operatorId: string,
  status: "활성화" | "비활성화",
): Promise<void> {
  const operator = await AdminUserModel.findOne({ id: operatorId, userType: "매니저" }).lean();
  if (!operator || !OPERATOR_USERNAMES.includes(operator.username as (typeof OPERATOR_USERNAMES)[number])) {
    throw new Error("시스템 운영자 계정만 상태를 변경할 수 있습니다.");
  }
  await AdminUserModel.updateOne({ id: operatorId }, { status });
}

export async function rotateAllOperatorPasswordsNow(): Promise<void> {
  const today = getKstDateKey();
  for (const username of OPERATOR_USERNAMES) {
    const doc = await AdminUserModel.findOne({ username }).lean();
    if (!doc) continue;
    const plain = generateDailyPassword();
    await AdminUserModel.updateOne(
      { id: doc.id },
      {
        password: await bcrypt.hash(plain, 10),
        dailyPasswordPlain: plain,
        dailyPasswordDate: today,
      },
    );
    try {
      await deleteSession("manager", doc.id);
    } catch {
      /* 세션 없음 */
    }
  }
}
