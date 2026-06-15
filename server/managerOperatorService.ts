import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { AdminUserModel, MatchModel } from "./UserStorage/db";
import { deleteSession } from "./sessionManager";

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

export async function getMatchNameForSlot(slot: number): Promise<string> {
  const matches = await MatchModel.find().sort({ startTime: 1 }).limit(OPERATOR_COUNT).lean();
  const match = matches[slot - 1];
  return match?.name ?? `${slot}경기`;
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

export async function syncOperatorMatchAssignments(): Promise<void> {
  for (let slot = 1; slot <= OPERATOR_COUNT; slot++) {
    const matchName = await getMatchNameForSlot(slot);
    await AdminUserModel.updateOne(
      { username: `op${slot}`, userType: "매니저" },
      { assignedMatchNumber: matchName, name: `${matchName} 운영자` },
    );
  }
}

export async function ensureOperatorsReady(): Promise<void> {
  const today = getKstDateKey();

  for (let slot = 1; slot <= OPERATOR_COUNT; slot++) {
    const username = `op${slot}`;
    const matchName = await getMatchNameForSlot(slot);
    const existing = await AdminUserModel.findOne({ username }).lean();

    if (!existing) {
      const plain = generateDailyPassword();
      const hash = await bcrypt.hash(plain, 10);
      await AdminUserModel.create({
        id: randomUUID(),
        username,
        email: `${username}@operators.ppamong.local`,
        name: `${matchName} 운영자`,
        password: hash,
        phone: `010000000${slot}0`,
        department: "현장운영",
        position: "운영자",
        userType: "매니저",
        approvalStatus: "승인",
        status: "활성화",
        assignedMatchNumber: matchName,
        operatorSlot: slot,
        dailyPasswordPlain: plain,
        dailyPasswordDate: today,
      });
      console.log(`[Operators] 계정 생성: ${username} → ${matchName}`);
      continue;
    }

    const updates: Record<string, unknown> = {
      userType: "매니저",
      approvalStatus: "승인",
      operatorSlot: slot,
      assignedMatchNumber: matchName,
      name: `${matchName} 운영자`,
    };

    if (existing.dailyPasswordDate !== today) {
      const plain = generateDailyPassword();
      updates.password = await bcrypt.hash(plain, 10);
      updates.dailyPasswordPlain = plain;
      updates.dailyPasswordDate = today;
    }

    await AdminUserModel.updateOne({ id: existing.id }, updates);
  }
}

export interface OperatorAccountView {
  id: string;
  username: string;
  name: string;
  assignedMatchNumber: string | null;
  status: string;
  dailyPasswordPlain: string;
  dailyPasswordDate: string;
  lastLogin: Date | null;
  operatorSlot: number;
}

export async function listOperatorAccounts(): Promise<OperatorAccountView[]> {
  await ensureOperatorsReady();

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
  const result: OperatorAccountView[] = [];

  for (const doc of docs) {
    let plain = (doc as { dailyPasswordPlain?: string }).dailyPasswordPlain ?? "";
    const dateKey = (doc as { dailyPasswordDate?: string }).dailyPasswordDate;

    if (dateKey !== today || !plain) {
      const rotated = await applyDailyPasswordIfNeeded(doc.id, dateKey, today);
      plain = rotated.plain ?? plain;
      if (!plain) {
        const refreshed = await AdminUserModel.findOne({ id: doc.id })
          .select("dailyPasswordPlain dailyPasswordDate")
          .lean();
        plain = (refreshed as { dailyPasswordPlain?: string })?.dailyPasswordPlain ?? "";
      }
    }

    result.push({
      id: doc.id,
      username: doc.username,
      name: doc.name,
      assignedMatchNumber: doc.assignedMatchNumber ?? null,
      status: doc.status,
      dailyPasswordPlain: plain,
      dailyPasswordDate: today,
      lastLogin: doc.lastLogin ?? null,
      operatorSlot: (doc as { operatorSlot?: number }).operatorSlot ?? 0,
    });
  }

  return result.sort((a, b) => a.operatorSlot - b.operatorSlot);
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
