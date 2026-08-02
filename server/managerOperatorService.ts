import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { AdminUserModel, MatchModel, StadiumModel } from "./UserStorage/db";
import { deleteSession } from "./sessionManager";
import { getKstDateString } from "./utils/dateUtils";
import {
  operatorAccountStatusFromPhase,
  resolveOperatorMatchPhase,
  type OperatorMatchPhase,
} from "../shared/operatorMatchStatus";
import {
  isStaleFinishedScoreboard,
  isStalePostponedScoreboard,
  isMisclassifiedTerminalStatus,
  hasLiveInningProgress,
} from "../shared/matchManagementStatus";

export const OPERATOR_USERNAMES = ["op1", "op2", "op3", "op4", "op5"] as const;
const OPERATOR_COUNT = 5;
const PASSWORD_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const API_SYNC_POLICY_VERSION = 2;

/** API 폴링 기본 ON: 1경기(op1)만 */
function defaultApiSyncEnabledForSlot(slot: number): boolean {
  return slot === 1;
}

/** op1~op5 — username이 슬롯의 기준 (op3 → 3) */
export function resolveOperatorSlot(username: string, operatorSlot?: number | null): number {
  const m = username.match(/^op(\d+)$/i);
  if (m) {
    const fromName = parseInt(m[1]!, 10);
    if (fromName >= 1 && fromName <= OPERATOR_COUNT) return fromName;
  }
  if (operatorSlot != null && operatorSlot >= 1 && operatorSlot <= OPERATOR_COUNT) {
    return operatorSlot;
  }
  return 0;
}

function isOperatorApiSyncEnabled(doc: { apiSyncEnabled?: boolean | null }, slot: number): boolean {
  if (doc.apiSyncEnabled === true) return true;
  if (doc.apiSyncEnabled === false) return false;
  return defaultApiSyncEnabledForSlot(slot);
}

/** op1~op5 슬롯별 API 폴링 ON/OFF (관리자 화면과 동일) */
export async function getApiSyncEnabledBySlot(): Promise<Map<number, boolean>> {
  const docs = await AdminUserModel.find({
    username: { $in: [...OPERATOR_USERNAMES] },
    userType: "매니저",
  })
    .select("username operatorSlot apiSyncEnabled")
    .lean();

  const map = new Map<number, boolean>();
  for (const doc of docs) {
    const slot = resolveOperatorSlot(doc.username, (doc as { operatorSlot?: number }).operatorSlot);
    if (slot > 0) {
      map.set(slot, isOperatorApiSyncEnabled(doc as { apiSyncEnabled?: boolean }, slot));
    }
  }
  return map;
}

export async function isApiSyncEnabledForRegistrationOrder(order: number): Promise<boolean> {
  if (order < 1 || order > OPERATOR_COUNT) return false;
  const map = await getApiSyncEnabledBySlot();
  return map.get(order) ?? false;
}

export async function getApiSyncEnabledRegistrationOrders(): Promise<number[]> {
  const docs = await AdminUserModel.find({
    username: { $in: [...OPERATOR_USERNAMES] },
    userType: "매니저",
  })
    .select("username operatorSlot apiSyncEnabled")
    .lean();

  return docs
    .map((doc) => {
      const slot = resolveOperatorSlot(doc.username, (doc as { operatorSlot?: number }).operatorSlot);
      if (slot <= 0) return null;
      return isOperatorApiSyncEnabled(doc as { apiSyncEnabled?: boolean }, slot) ? slot : null;
    })
    .filter((slot): slot is number => slot != null)
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

/** URL-safe 로그인 링크 토큰 */
export function generateLoginLinkToken(): string {
  return randomBytes(24).toString("base64url");
}

/** KST 기준 다음 자정 — 담당 경기 없을 때 fallback 만료 */
export function getLoginLinkExpiryDate(): Date {
  const kstDate = getKstDateKey(); // YYYY-MM-DD
  // 다음 KST 자정 = 당일 15:00 UTC
  return new Date(`${kstDate}T15:00:00.000Z`);
}

/** 운영자 슬롯에 배정된 오늘 경기 종료 시각 (없으면 KST 자정) */
export async function getOperatorCredentialsExpiryDate(operatorSlot: number): Promise<Date> {
  if (operatorSlot <= 0) {
    return getLoginLinkExpiryDate();
  }
  const matches = await getTodayMatchesByRegistrationOrder();
  const match = findTodayMatchByRegistrationOrder(matches, operatorSlot);
  if (!match || match.matchStatus === "completed" || match.matchStatus === "cancelled") {
    return getLoginLinkExpiryDate();
  }
  return new Date(match.endTime);
}

function isMatchEnded(matchStatus: string): boolean {
  return matchStatus === "completed" || matchStatus === "cancelled";
}

async function getAssignedMatchForOperator(slot: number): Promise<{ id: string; endTime: Date; matchStatus: string } | null> {
  if (slot <= 0) return null;

  const matches = await getTodayMatchesByRegistrationOrder();
  const match = findTodayMatchByRegistrationOrder(matches, slot);
  if (!match) return null;

  return {
    id: match.id,
    endTime: match.endTime,
    matchStatus: match.matchStatus,
  };
}

/** 시스템 운영자(op1~op5) 로그인 정보가 담당 경기 종료 전인지 확인 */
export async function assertOperatorLoginAllowed(doc: {
  id?: string;
  username: string;
  operatorSlot?: number | null;
}): Promise<void> {
  if (!OPERATOR_USERNAMES.includes(doc.username as (typeof OPERATOR_USERNAMES)[number])) {
    return;
  }

  const credDoc = doc.id
    ? await AdminUserModel.findOne({ id: doc.id })
        .select("dailyPasswordPlain operatorSlot username")
        .lean()
    : await AdminUserModel.findOne({ username: doc.username, userType: "매니저" })
        .select("dailyPasswordPlain operatorSlot username")
        .lean();

  if (!(credDoc as { dailyPasswordPlain?: string } | null)?.dailyPasswordPlain) {
    throw new Error("로그인 정보가 만료되었습니다. 관리자에게 새 정보를 요청하세요.");
  }

  const slot = resolveOperatorSlot(
    (credDoc as { username?: string } | null)?.username ?? doc.username,
    (credDoc as { operatorSlot?: number | null } | null)?.operatorSlot ?? doc.operatorSlot,
  );
  const match = await getAssignedMatchForOperator(slot);
  if (!match) {
    throw new Error("오늘 배정된 경기가 없습니다. 관리자에게 문의하세요.");
  }
  if (isMatchEnded(match.matchStatus)) {
    throw new Error("담당 경기가 종료되어 로그인 정보가 만료되었습니다. 관리자에게 새 정보를 요청하세요.");
  }
  if (new Date(match.endTime).getTime() < Date.now()) {
    throw new Error("로그인 정보가 만료되었습니다. 관리자에게 새 정보를 요청하세요.");
  }
}

async function invalidateOperatorCredentials(managerId: string): Promise<void> {
  const placeholder = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  await AdminUserModel.updateOne(
    { id: managerId },
    {
      password: placeholder,
      dailyPasswordPlain: "",
      dailyPasswordDate: "",
      loginLinkToken: "",
      loginLinkExpiresAt: null,
    },
  );
}

/** 경기 종료 시 담당 운영자 자격·세션 무효화 (당일 ID/PW·링크 재사용 불가) */
export async function revokeOperatorAccessForMatchEnd(matchId: string): Promise<string[]> {
  const match = await MatchModel.findOne({ id: matchId })
    .select("name registrationOrder")
    .lean();
  if (!match) return [];

  const operatorIds: string[] = [];
  const seen = new Set<string>();

  const order = (match as { registrationOrder?: number | null }).registrationOrder;
  if (order != null && order >= 1 && order <= OPERATOR_COUNT) {
    const slotOp = await AdminUserModel.findOne({
      username: `op${order}`,
      userType: "매니저",
    })
      .select("id")
      .lean();
    if (slotOp && !seen.has(slotOp.id)) {
      seen.add(slotOp.id);
      operatorIds.push(slotOp.id);
    }
  }

  for (const operatorId of operatorIds) {
    await invalidateOperatorCredentials(operatorId);
    await AdminUserModel.updateOne({ id: operatorId }, { status: "비활성화" });
    await deleteSession("manager", operatorId);
  }

  if (operatorIds.length > 0) {
    console.log(
      `[Operators] 경기 종료 — ${operatorIds.length}명 운영자 자격·세션 무효화 (${match.name})`,
    );
  }

  return operatorIds;
}

export async function isOperatorCredentialsActive(managerId: string): Promise<boolean> {
  const doc = await AdminUserModel.findOne({ id: managerId })
    .select("username operatorSlot")
    .lean();
  if (!doc) return false;
  if (!OPERATOR_USERNAMES.includes(doc.username as (typeof OPERATOR_USERNAMES)[number])) {
    return true;
  }
  try {
    await assertOperatorLoginAllowed({
      id: doc.id,
      username: doc.username,
      operatorSlot: (doc as { operatorSlot?: number }).operatorSlot,
    });
    return true;
  } catch {
    return false;
  }
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
  endTime: Date;
  matchStatus: string;
  stadiumName: string;
  registrationOrder: number;
  awayTeamName: string;
  homeTeamName: string;
  statusShort?: string;
  statusLong?: string;
  homeScore?: number;
  awayScore?: number;
  inning?: number | null;
  inningLabel?: string;
}

function teamNamesFromMatchRow(row: Record<string, unknown>): { away: string; home: string } {
  const board = row.liveScoreboard as { awayTeamName?: string; homeTeamName?: string } | null | undefined;
  const away =
    (row.apiSportsAwayTeam as string | undefined)?.trim() ||
    board?.awayTeamName?.trim() ||
    "";
  const home =
    (row.apiSportsHomeTeam as string | undefined)?.trim() ||
    board?.homeTeamName?.trim() ||
    "";
  return { away, home };
}

export function findTodayMatchByRegistrationOrder(
  matches: OrderedTodayMatch[],
  order: number,
): OrderedTodayMatch | undefined {
  return matches.find((m) => m.registrationOrder === order);
}

/** op 슬롯 담당 경기 1줄 — 제 N경기 (원정 : 홈) */
export function formatOperatorMatchTitle(slot: number, match?: OrderedTodayMatch | null): string {
  const prefix = `제 ${slot}경기`;
  if (!match) return prefix;
  const away = match.awayTeamName.trim();
  const home = match.homeTeamName.trim();
  if (away && home) return `${prefix} (${away} : ${home})`;
  return prefix;
}

/** KST 시작 시각 (담당 경기 2줄째) */
export function formatOperatorMatchStartTime(match?: OrderedTodayMatch | null): string | null {
  if (!match?.startTime) return null;
  return new Date(match.startTime).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export function resolveOperatorMatchPhaseFromTodayMatch(
  match?: OrderedTodayMatch | null,
): OperatorMatchPhase | null {
  if (!match) return null;

  const staleInput = {
    matchStatus: match.matchStatus,
    statusShort: match.statusShort,
    statusLong: match.statusLong,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    inning: match.inning,
    inningLabel: match.inningLabel,
  };

  if (isMisclassifiedTerminalStatus(staleInput)) {
    return "경기중";
  }

  const recoverFromStale = (): OperatorMatchPhase => {
    const started = Date.now() >= new Date(match.startTime).getTime();
    if (started || match.matchStatus === "ongoing" || hasLiveInningProgress(staleInput)) {
      return "경기중";
    }
    return "경기전";
  };

  if (isStalePostponedScoreboard(staleInput) || isStaleFinishedScoreboard(staleInput)) {
    return recoverFromStale();
  }

  return resolveOperatorMatchPhase({
    matchStatus: match.matchStatus,
    statusShort: match.statusShort,
    statusLong: match.statusLong,
  });
}

/** 담당 경기 2줄 — 「경기중 · 2026. 8. 2. 오후 6:00:00」 */
export function formatOperatorMatchDetail(
  match?: OrderedTodayMatch | null,
  phase?: OperatorMatchPhase | null,
): string {
  if (!match && !phase) return "(오늘 경기 없음)";
  const time = formatOperatorMatchStartTime(match);
  if (phase && time) return `${phase} · ${time}`;
  if (phase) return phase;
  if (time) return time;
  return "(오늘 경기 없음)";
}

/** opN 계정 상태를 담당 경기 phase에 맞춤 */
export async function syncOperatorAccountStatusForSlot(
  slot: number,
  phase: OperatorMatchPhase | null,
): Promise<void> {
  if (slot < 1 || slot > OPERATOR_COUNT) return;

  const username = `op${slot}`;
  const nextStatus = operatorAccountStatusFromPhase(phase);
  const operator = await AdminUserModel.findOne({ username, userType: "매니저" })
    .select("status")
    .lean();
  if (!operator || operator.status === nextStatus) return;

  await AdminUserModel.updateOne({ username, userType: "매니저" }, { status: nextStatus });
}

/** registrationOrder 1~5 경기 상태 변경 시 해당 op 슬롯 계정 상태 동기화 */
export async function syncOperatorAccountStatusForMatchId(matchId: string): Promise<void> {
  const match = await MatchModel.findOne({ id: matchId })
    .select("registrationOrder matchStatus liveScoreboard")
    .lean();
  if (!match) return;

  const order = (match as { registrationOrder?: number | null }).registrationOrder;
  if (order == null || order < 1 || order > OPERATOR_COUNT) return;

  const board = (match as { liveScoreboard?: { statusShort?: string; statusLong?: string } | null })
    .liveScoreboard;
  const phase = resolveOperatorMatchPhase({
    matchStatus: match.matchStatus,
    statusShort: board?.statusShort,
    statusLong: board?.statusLong,
  });
  await syncOperatorAccountStatusForSlot(order, phase);
}

/** op1~op5 전원 — 오늘 담당 경기 기준 계정 상태 동기화 */
export async function syncAllOperatorAccountStatuses(): Promise<void> {
  const matches = await getTodayMatchesByRegistrationOrder();
  for (let slot = 1; slot <= OPERATOR_COUNT; slot++) {
    const match = findTodayMatchByRegistrationOrder(matches, slot);
    const phase = resolveOperatorMatchPhaseFromTodayMatch(match);
    await syncOperatorAccountStatusForSlot(slot, phase);
  }
}

export async function getTodayMatchesByRegistrationOrder(): Promise<OrderedTodayMatch[]> {
  const docs = await MatchModel.find({
    ...todayMatchFilter(),
    registrationOrder: { $gte: 1, $lte: OPERATOR_COUNT },
  })
    .sort({ registrationOrder: 1, createdAt: 1, _id: 1 })
    .lean();

  const result: OrderedTodayMatch[] = [];
  for (let i = 0; i < docs.length; i++) {
    const row = docs[i]!;
    const stadium = await StadiumModel.findOne({ id: row.stadiumId }).select("name").lean();
    const { away, home } = teamNamesFromMatchRow(row as Record<string, unknown>);
    const board = (row as { liveScoreboard?: { statusShort?: string; statusLong?: string } | null })
      .liveScoreboard;
    result.push({
      id: row.id,
      name: row.name,
      startTime: row.startTime,
      endTime: row.endTime,
      matchStatus: (row as { matchStatus?: string }).matchStatus ?? "scheduled",
      stadiumName: stadium?.name ?? "",
      registrationOrder: (row as { registrationOrder?: number }).registrationOrder ?? i + 1,
      awayTeamName: away,
      homeTeamName: home,
      statusShort: board?.statusShort,
      statusLong: board?.statusLong,
      homeScore: (board as { homeScore?: number } | undefined)?.homeScore,
      awayScore: (board as { awayScore?: number } | undefined)?.awayScore,
      inning: (board as { inning?: number | null } | undefined)?.inning ?? null,
      inningLabel: (board as { inningLabel?: string } | undefined)?.inningLabel,
    });
  }
  return result;
}

async function setOperatorPassword(
  managerId: string,
  plain: string,
): Promise<{ loginLinkToken: string }> {
  const operator = await AdminUserModel.findOne({ id: managerId })
    .select("username operatorSlot")
    .lean();
  const slot = resolveOperatorSlot(operator?.username ?? "", operator?.operatorSlot);
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
      loginLinkExpiresAt: await getOperatorCredentialsExpiryDate(slot),
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
    throw new Error("유효하지 않은 로그인 링크입니다.");
  }

  if (!OPERATOR_USERNAMES.includes(doc.username as (typeof OPERATOR_USERNAMES)[number])) {
    throw new Error("시스템 운영자 계정만 링크 로그인을 사용할 수 있습니다.");
  }

  await assertOperatorLoginAllowed(doc);

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

/** 로그인 링크 검증 (토큰은 로그인 후에도 경기 종료 전까지 재사용 가능) */
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

/** opN → 제N경기 고정 (API ON/OFF와 무관) */
export async function syncOperatorMatchAssignments(): Promise<void> {
  const matches = await getTodayMatchesByRegistrationOrder();

  for (let slot = 1; slot <= OPERATOR_COUNT; slot++) {
    const username = `op${slot}`;
    const match = findTodayMatchByRegistrationOrder(matches, slot);
    const assignedMatchNumber = formatOperatorMatchTitle(slot, match);

    await AdminUserModel.updateOne(
      { username, userType: "매니저" },
      {
        assignedMatchNumber,
        operatorSlot: slot,
        name: `${slot}번 운영자`,
      },
    );
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
  assignedMatchStatusLabel: OperatorMatchPhase | null;
  assignedMatchDetail: string | null;
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
  await syncAllOperatorAccountStatuses();

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
    const slot = resolveOperatorSlot(doc.username, (doc as { operatorSlot?: number }).operatorSlot);
    const plain = (doc as { dailyPasswordPlain?: string }).dailyPasswordPlain ?? "";
    const dateKey = (doc as { dailyPasswordDate?: string }).dailyPasswordDate ?? "";
    const linkToken = (doc as { loginLinkToken?: string }).loginLinkToken ?? "";
    const assignedMatch = slot > 0 ? findTodayMatchByRegistrationOrder(todayMatches, slot) : undefined;
    const matchEnded = assignedMatch ? isMatchEnded(assignedMatch.matchStatus) : false;
    const matchExpired = assignedMatch
      ? new Date(assignedMatch.endTime).getTime() <= now
      : false;
    const loginLinkActive = Boolean(linkToken) && !matchEnded && !matchExpired;
    const apiSyncEnabled = isOperatorApiSyncEnabled(doc as { apiSyncEnabled?: boolean }, slot);
    const assignedMatchPhase = resolveOperatorMatchPhaseFromTodayMatch(assignedMatch);
    const assignedMatchDetail = assignedMatch
      ? formatOperatorMatchStartTime(assignedMatch)
      : "(오늘 경기 없음)";
    const accountStatus = operatorAccountStatusFromPhase(assignedMatchPhase);

    operators.push({
      id: doc.id,
      username: doc.username,
      name: doc.name,
      assignedMatchNumber: formatOperatorMatchTitle(slot, assignedMatch),
      assignedMatchStatusLabel: assignedMatchPhase,
      assignedMatchDetail,
      status: accountStatus,
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

  // 배정은 opN→제N경기 고정 — API ON/OFF는 라이브 폴링 대상만 변경
  const { scheduleLiveScoreSync } = await import("./apiSports/liveScoreSync");
  await scheduleLiveScoreSync();
}
