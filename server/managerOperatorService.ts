import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { AdminUserModel, MatchModel, StadiumModel } from "./UserStorage/db";
import { deleteSession } from "./sessionManager";
import { getKstDateString } from "./utils/dateUtils";

export const OPERATOR_USERNAMES = ["op1", "op2", "op3", "op4", "op5"] as const;
const OPERATOR_COUNT = 5;
const PASSWORD_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const API_SYNC_POLICY_VERSION = 2;

/** API 폴링 기본 ON: 1경기(op1)만 */
function defaultApiSyncEnabledForSlot(slot: number): boolean {
  return slot === 1;
}

export async function getApiSyncEnabledRegistrationOrders(): Promise<number[]> {
  const docs = await AdminUserModel.find({
    username: { $in: [...OPERATOR_USERNAMES] },
    userType: "매니저",
    apiSyncEnabled: { $ne: false },
  })
    .select("operatorSlot")
    .lean();

  return docs
    .map((doc) => (doc as { operatorSlot?: number }).operatorSlot ?? 0)
    .filter((slot) => slot > 0)
    .sort((a, b) => a - b);
}

export async function getMaxLinkedGamesForSync(): Promise<number> {
  return getApiSyncEnabledRegistrationOrders().then((orders) => orders.length);
}

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

/** URL-safe 일회용 로그인 토큰 */
export function generateLoginLinkToken(): string {
  return randomBytes(24).toString("base64url");
}

/** KST 기준 다음 자정(당일 링크 만료)에 해당하는 UTC Date */
export function getLoginLinkExpiryDate(): Date {
  const kstDate = getKstDateKey(); // YYYY-MM-DD
  // 다음 KST 자정 = 당일 15:00 UTC
  return new Date(`${kstDate}T15:00:00.000Z`);
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

async function setOperatorPassword(
  managerId: string,
  plain: string,
): Promise<{ loginLinkToken: string }> {
  const hash = await bcrypt.hash(plain, 10);
  const today = getKstDateKey();
  const loginLinkToken = generateLoginLinkToken();
  await AdminUserModel.updateOne(
    { id: managerId },
    {
      password: hash,
      dailyPasswordPlain: plain,
      dailyPasswordDate: today,
      loginLinkToken,
      loginLinkExpiresAt: getLoginLinkExpiryDate(),
    },
  );
  try {
    await deleteSession("manager", managerId);
  } catch {
    /* 세션 없음 */
  }
  return { loginLinkToken };
}

export async function rotateOperatorPassword(operatorId: string): Promise<{ loginLinkToken: string }> {
  const doc = await AdminUserModel.findOne({ id: operatorId, userType: "매니저" }).lean();
  if (!doc || !OPERATOR_USERNAMES.includes(doc.username as (typeof OPERATOR_USERNAMES)[number])) {
    throw new Error("시스템 운영자 계정만 비밀번호를 재발급할 수 있습니다.");
  }
  const plain = generateDailyPassword();
  return setOperatorPassword(doc.id, plain);
}

export interface LoginLinkConsumeResult {
  managerId: string;
  email: string;
  userType: string;
  approvalStatus: string;
  status: string;
  username: string;
  assignedMatchNumber: string | null;
  operatorSlot: number;
}

export interface LoginLinkPreview {
  username: string;
  assignedMatchNumber: string | null;
  operatorSlot: number;
}

async function findValidLoginLinkDoc(token: string) {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("로그인 링크가 올바르지 않습니다.");
  }

  const doc = await AdminUserModel.findOne({
    loginLinkToken: trimmed,
    userType: "매니저",
  }).lean();

  if (!doc) {
    throw new Error("이미 사용되었거나 유효하지 않은 로그인 링크입니다.");
  }

  if (!OPERATOR_USERNAMES.includes(doc.username as (typeof OPERATOR_USERNAMES)[number])) {
    throw new Error("시스템 운영자 계정만 링크 로그인을 사용할 수 있습니다.");
  }

  const expiresAt = (doc as { loginLinkExpiresAt?: Date | null }).loginLinkExpiresAt;
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    await AdminUserModel.updateOne(
      { id: doc.id },
      { loginLinkToken: "", loginLinkExpiresAt: null },
    );
    throw new Error("로그인 링크가 만료되었습니다. 관리자에게 다시 요청하세요.");
  }

  if (doc.approvalStatus !== "승인") {
    throw new Error("계정이 승인되지 않았습니다.");
  }

  if (doc.status === "비활성화") {
    throw new Error("비활성화된 계정입니다. 관리자에게 문의하세요.");
  }

  return doc;
}

/** 로그인 화면 표시용 — 토큰은 소비하지 않음 */
export async function peekLoginLinkToken(token: string): Promise<LoginLinkPreview> {
  const doc = await findValidLoginLinkDoc(token);
  return {
    username: doc.username,
    assignedMatchNumber: doc.assignedMatchNumber ?? null,
    operatorSlot: (doc as { operatorSlot?: number }).operatorSlot ?? 0,
  };
}

/** 일회용 로그인 링크 검증 (토큰 소비 없음) */
export async function resolveLoginLinkToken(token: string): Promise<LoginLinkConsumeResult> {
  const doc = await findValidLoginLinkDoc(token.trim());
  return {
    managerId: doc.id,
    email: doc.email,
    userType: doc.userType,
    approvalStatus: doc.approvalStatus,
    status: doc.status,
    username: doc.username,
    assignedMatchNumber: doc.assignedMatchNumber ?? null,
    operatorSlot: (doc as { operatorSlot?: number }).operatorSlot ?? 0,
  };
}

/** 로그인 성공 후 링크 토큰 무효화 */
export async function burnLoginLinkToken(managerId: string, token: string): Promise<void> {
  const trimmed = token.trim();
  const cleared = await AdminUserModel.findOneAndUpdate(
    { id: managerId, loginLinkToken: trimmed },
    { loginLinkToken: "", loginLinkExpiresAt: null },
    { new: false },
  ).lean();

  if (!cleared) {
    throw new Error("이미 사용되었거나 유효하지 않은 로그인 링크입니다.");
  }
}

/** @deprecated resolveLoginLinkToken + burnLoginLinkToken 사용 */
export async function consumeLoginLinkToken(token: string): Promise<LoginLinkConsumeResult> {
  const resolved = await resolveLoginLinkToken(token);
  await burnLoginLinkToken(resolved.managerId, token);
  return resolved;
}

/** 오늘 경기 등록 순서 → API 동기화 ON인 op만 할당 */
export async function syncOperatorMatchAssignments(): Promise<void> {
  const matches = await getTodayMatchesByRegistrationOrder();
  const enabledOrders = await getApiSyncEnabledRegistrationOrders();

  for (let slot = 1; slot <= OPERATOR_COUNT; slot++) {
    const username = `op${slot}`;
    const operator = await AdminUserModel.findOne({ username, userType: "매니저" })
      .select("apiSyncEnabled")
      .lean();
    const syncEnabled = (operator as { apiSyncEnabled?: boolean } | null)?.apiSyncEnabled !== false;

    if (!syncEnabled) {
      await AdminUserModel.updateOne(
        { username, userType: "매니저" },
        {
          assignedMatchNumber: null,
          name: `${slot}번 운영자 (동기화 OFF)`,
        },
      );
      continue;
    }

    const enabledIndex = enabledOrders.indexOf(slot);
    const match = enabledIndex >= 0 ? matches[enabledIndex] : undefined;

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
  for (let slot = 1; slot <= OPERATOR_COUNT; slot++) {
    const username = `op${slot}`;
    const existing = await AdminUserModel.findOne({ username }).lean();

    if (!existing) {
      const placeholder = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
      await AdminUserModel.create({
        id: randomUUID(),
        username,
        email: `${username}@operators.ppamong.local`,
        name: `${slot}번 운영자`,
        password: placeholder,
        phone: `010000000${slot}0`,
        department: "현장운영",
        position: "운영자",
        userType: "매니저",
        approvalStatus: "승인",
        status: "활성화",
        assignedMatchNumber: null,
        operatorSlot: slot,
        dailyPasswordPlain: "",
        dailyPasswordDate: "",
        loginLinkToken: "",
        loginLinkExpiresAt: null,
        apiSyncEnabled: defaultApiSyncEnabledForSlot(slot),
        apiSyncDefaultPolicy: API_SYNC_POLICY_VERSION,
      });
      console.log(`[Operators] 계정 생성: ${username} (비밀번호는 관리자 수동 생성 필요)`);
      continue;
    }

    const updates: Record<string, unknown> = {
      userType: "매니저",
      approvalStatus: "승인",
      operatorSlot: slot,
    };

    if ((existing as { apiSyncEnabled?: boolean }).apiSyncEnabled === undefined) {
      updates.apiSyncEnabled = defaultApiSyncEnabledForSlot(slot);
    }

    const policyVersion =
      (existing as { apiSyncDefaultPolicy?: number }).apiSyncDefaultPolicy ?? 1;
    if (policyVersion < API_SYNC_POLICY_VERSION) {
      updates.apiSyncEnabled = defaultApiSyncEnabledForSlot(slot);
      updates.apiSyncDefaultPolicy = API_SYNC_POLICY_VERSION;
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
  loginLinkToken: string;
  loginLinkActive: boolean;
  apiSyncEnabled: boolean;
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
      "id username name assignedMatchNumber status dailyPasswordPlain dailyPasswordDate loginLinkToken loginLinkExpiresAt lastLogin operatorSlot apiSyncEnabled",
    )
    .sort({ operatorSlot: 1 })
    .lean();

  const operators: OperatorAccountView[] = [];
  const now = Date.now();

  for (const doc of docs) {
    const slot = (doc as { operatorSlot?: number }).operatorSlot ?? 0;
    const plain = (doc as { dailyPasswordPlain?: string }).dailyPasswordPlain ?? "";
    const dateKey = (doc as { dailyPasswordDate?: string }).dailyPasswordDate ?? "";
    const linkToken = (doc as { loginLinkToken?: string }).loginLinkToken ?? "";
    const linkExpires = (doc as { loginLinkExpiresAt?: Date | null }).loginLinkExpiresAt;
    const loginLinkActive =
      Boolean(linkToken) && (!linkExpires || new Date(linkExpires).getTime() > now);
    const apiSyncEnabled = (doc as { apiSyncEnabled?: boolean }).apiSyncEnabled !== false;

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
      dailyPasswordDate: dateKey,
      loginLinkToken: loginLinkActive ? linkToken : "",
      loginLinkActive,
      apiSyncEnabled,
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

export async function setOperatorApiSyncEnabled(operatorId: string, enabled: boolean): Promise<void> {
  const operator = await AdminUserModel.findOne({ id: operatorId, userType: "매니저" }).lean();
  if (!operator || !OPERATOR_USERNAMES.includes(operator.username as (typeof OPERATOR_USERNAMES)[number])) {
    throw new Error("시스템 운영자 계정만 동기화 설정을 변경할 수 있습니다.");
  }
  await AdminUserModel.updateOne({ id: operatorId }, { apiSyncEnabled: enabled });
  await syncOperatorMatchAssignments();
}
