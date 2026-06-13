import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, serial, integer, boolean, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  password: text("password"),
  phone: text("phone").unique(),
  email: text("email"),
  provider: text("provider").notNull().default("local"),
  providerId: text("provider_id"),
  inviteCode: text("invite_code").unique(), // 내 고유 초대 코드 (6자리 영문+숫자)
  referralCode: text("referral_code"), // 회원가입 시 입력한 추천인의 초대 코드
  verificationCode: text("verification_code"),
  verificationCodeExpiry: timestamp("verification_code_expiry", { mode: 'date', withTimezone: true, precision: 3 }),
  points: integer("points").notNull().default(0),
  lastAttendanceDate: timestamp("last_attendance_date", { mode: 'date', withTimezone: true, precision: 3 }),
  isSuspended: integer("is_suspended").notNull().default(0),
  suspendedAt: timestamp("suspended_at", { mode: 'date', withTimezone: true, precision: 3 }),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
  isOnline: integer("is_online").notNull().default(0),
  lastLogin: timestamp("last_login_at", { mode: 'date', withTimezone: true, precision: 3 }),
  lastLogout: timestamp("last_logout_at", { mode: 'date', withTimezone: true, precision: 3 }),
  lastActive: timestamp("last_active_at", { mode: 'date', withTimezone: true, precision: 3 }),
  totalDonationAmount: integer("total_donation_amount").notNull().default(0),
}, (table) => ({
  uniqueProviderUser: unique().on(table.provider, table.providerId),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  inviteCode: true, // 회원가입 시 자동 생성
  points: true,
  lastAttendanceDate: true,
  isSuspended: true,
  suspendedAt: true,
  createdAt: true,
  isOnline: true,
  lastLogin: true,
  lastLogout: true,
  lastActive: true,
  totalDonationAmount: true,
  provider: true,
  providerId: true,
}).extend({
  provider: z.enum(["local", "kakao", "google", "apple", "guest"]).default("local"),
  providerId: z.string().optional(),
  password: z.string().optional(),
  name: z.string().min(1, "이름을 입력해 주세요.").max(15, "이름은 최대 15자까지 입력 가능합니다."),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const stadiums = pgTable("stadiums", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
});

export const insertStadiumSchema = createInsertSchema(stadiums).omit({
  id: true,
  createdAt: true,
});

export type InsertStadium = z.infer<typeof insertStadiumSchema>;
export type Stadium = typeof stadiums.$inferSelect;

export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  stadiumId: integer("stadium_id").notNull().references(() => stadiums.id),
  matchDate: date("match_date"), // 경기 날짜 (YYYY-MM-DD) - nullable for backward compatibility
  startTime: timestamp("start_time", { mode: 'date', withTimezone: true, precision: 3 }).notNull(),
  endTime: timestamp("end_time", { mode: 'date', withTimezone: true, precision: 3 }).notNull(),
  matchStatus: text("match_status").notNull().default("scheduled"), // scheduled, ongoing, completed, cancelled
  currentRound: integer("current_round").notNull().default(1),
  predictionEnabled: boolean("prediction_enabled").notNull().default(false),
});

export const insertMatchSchema = createInsertSchema(matches).omit({
  currentRound: true,
  predictionEnabled: true,
  matchDate: true, // matchDate를 명시적으로 처리하기 위해 제외
}).extend({
  id: z.string().optional(), // UPSERT를 위해 optional id 허용
  matchDate: z.string()
    .optional()
    .transform(v => v || null), // YYYY-MM-DD 문자열을 그대로 유지 (Drizzle date 타입은 string 기대)
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});

export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matches.$inferSelect;

export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  attendanceDate: timestamp("attendance_date", { mode: 'date', withTimezone: true, precision: 3 }).notNull(),
});

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({
  id: true,
});

export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: varchar("author_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
  viewCount: integer("view_count").notNull().default(0),
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
  viewCount: true,
});

export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authorId: varchar("author_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

export const pointTransactions = pgTable("point_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionType: text("transaction_type").notNull(), // 'earned' or 'spent'
  amount: integer("amount").notNull(), // 획득이면 양수, 사용이면 음수
  balance: integer("balance").notNull(), // 거래 후 잔액
  description: text("description").notNull(), // 거래 설명
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
});

export const insertPointTransactionSchema = createInsertSchema(pointTransactions).omit({
  id: true,
  createdAt: true,
});

export type InsertPointTransaction = z.infer<typeof insertPointTransactionSchema>;
export type PointTransaction = typeof pointTransactions.$inferSelect;

export const inquiries = pgTable("inquiries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  category: text("category").notNull(), // "계정 문제", "게임 문제", "기술적 문제", "기타"
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("pending"), // pending, in_progress, resolved
  response: text("response"),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
});

export const insertInquirySchema = createInsertSchema(inquiries).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type InsertInquiry = z.infer<typeof insertInquirySchema>;
export type Inquiry = typeof inquiries.$inferSelect;

export const notices = pgTable("notices", {
  id: serial("id").primaryKey(),
  tag: text("tag").notNull(), // "공지", "업데이트", "이벤트" 등
  title: text("title").notNull(),
  content: text("content").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
});

export const insertNoticeSchema = createInsertSchema(notices).omit({
  id: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNotice = z.infer<typeof insertNoticeSchema>;
export type Notice = typeof notices.$inferSelect;

export const terms = pgTable("terms", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull(), // "service", "privacy" 등
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
});

export const insertTermSchema = createInsertSchema(terms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTerm = z.infer<typeof insertTermSchema>;
export type Term = typeof terms.$inferSelect;

export const faqs = pgTable("faqs", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
});

export const insertFaqSchema = createInsertSchema(faqs).omit({
  id: true,
  createdAt: true,
});

export type InsertFaq = z.infer<typeof insertFaqSchema>;
export type Faq = typeof faqs.$inferSelect;

export const ebooks = pgTable("ebooks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
});

export const insertEbookSchema = createInsertSchema(ebooks).omit({
  id: true,
  createdAt: true,
});

export type InsertEbook = z.infer<typeof insertEbookSchema>;
export type Ebook = typeof ebooks.$inferSelect;

export const ebookPurchases = pgTable("ebook_purchases", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  ebookId: integer("ebook_id").notNull().references(() => ebooks.id),
  purchasedAt: timestamp("purchased_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
});

export const insertEbookPurchaseSchema = createInsertSchema(ebookPurchases).omit({
  id: true,
  purchasedAt: true,
});

export type InsertEbookPurchase = z.infer<typeof insertEbookPurchaseSchema>;
export type EbookPurchase = typeof ebookPurchases.$inferSelect;

export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  department: text("department"),
  position: text("position"),
  phone: text("phone").notNull(),
  userType: text("user_type").notNull().default("일반어드민"),
  approvalStatus: text("approval_status").notNull().default("대기중"),
  status: text("status").notNull().default("활성화"),
  lastLogin: timestamp("last_login", { mode: 'date', withTimezone: true, precision: 3 }),
  lastLogout: timestamp("last_logout", { mode: 'date', withTimezone: true, precision: 3 }),
  logoutAllowed: boolean("logout_allowed").notNull().default(false),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
  username: text("username").notNull().unique(),
  assignedMatchNumber: text("assigned_match_number"), // "1경기", "2경기", etc.
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
  lastLogin: true,
  lastLogout: true,
  logoutAllowed: true,
}).extend({
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
  password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다."),
  userType: z.enum(["일반어드민", "슈퍼어드민", "매니저"]).default("일반어드민"),
  approvalStatus: z.enum(["대기중", "승인", "거부"]).default("대기중"),
  status: z.enum(["활성화", "비활성화"]).default("활성화"),
});

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

// matchAssignments 테이블 제거 - adminUsers.assignedMatchNumber 사용

export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  matchId: varchar("match_id").notNull().references(() => matches.id),
  roundNumber: integer("round_number").notNull().default(1),
  prediction: text("prediction").notNull(), // "1루", "2루", "3루", "홈런", "아웃"
  amount: integer("amount").notNull().default(100),
  status: text("status").notNull().default("pending"), // pending, success, fail
  result: text("result"), // 실제 경기 결과
  wonAmount: integer("won_amount").notNull().default(0), // 승리 시 받은 포인트 (반올림)
  donatedAmount: integer("donated_amount").notNull().default(0), // 기부한 포인트
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
}, (table) => ({
  uniqueUserRoundPrediction: unique().on(table.userId, table.matchId, table.roundNumber),
}));

export const insertPredictionSchema = createInsertSchema(predictions).omit({
  id: true,
  createdAt: true,
  status: true,
  result: true,
});

export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictions.$inferSelect;

export const roundStatistics = pgTable("round_statistics", {
  id: serial("id").primaryKey(),
  matchId: varchar("match_id").notNull().references(() => matches.id),
  roundNumber: integer("round_number").notNull(),
  totalParticipants: integer("total_participants").notNull().default(0),
  totalPoints: integer("total_points").notNull().default(0),
  totalWinners: integer("total_winners").notNull().default(0),
  predictionStartTime: timestamp("prediction_start_time", { mode: 'date', withTimezone: true, precision: 3 }),
  predictionStopTime: timestamp("prediction_stop_time", { mode: 'date', withTimezone: true, precision: 3 }),
  isPredictionStarted: boolean("is_prediction_started").notNull().default(false),
  isPredictionStopped: boolean("is_prediction_stopped").notNull().default(false),
  isResultSent: boolean("is_result_sent").notNull().default(false),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
});

export const insertRoundStatisticsSchema = createInsertSchema(roundStatistics).omit({
  id: true,
  createdAt: true,
});

export type InsertRoundStatistics = z.infer<typeof insertRoundStatisticsSchema>;
export type RoundStatistics = typeof roundStatistics.$inferSelect;

export const waitingScreens = pgTable("waiting_screens", {
  id: serial("id").primaryKey(),
  videoName: text("video_name").notNull(),
  displayDuration: integer("display_duration").notNull().default(4),
  videoUrl: text("video_url").notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
});

export const insertWaitingScreenSchema = createInsertSchema(waitingScreens).omit({
  id: true,
  createdAt: true,
});

export type InsertWaitingScreen = z.infer<typeof insertWaitingScreenSchema>;
export type WaitingScreen = typeof waitingScreens.$inferSelect;

export const advertisements = pgTable("advertisements", {
  id: serial("id").primaryKey(),
  videoName: text("video_name").notNull(),
  earnedPoints: integer("earned_points").notNull().default(4),
  videoUrl: text("video_url").notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
});

export const insertAdvertisementSchema = createInsertSchema(advertisements).omit({
  id: true,
  createdAt: true,
});

export type InsertAdvertisement = z.infer<typeof insertAdvertisementSchema>;
export type Advertisement = typeof advertisements.$inferSelect;

export const adViewHistory = pgTable("ad_view_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  advertisementId: integer("advertisement_id").notNull().references(() => advertisements.id),
  viewedAt: timestamp("viewed_at", { mode: 'date', withTimezone: true, precision: 3 }).notNull().default(sql`now()`),
});

export const insertAdViewHistorySchema = createInsertSchema(adViewHistory).omit({
  id: true,
  viewedAt: true,
});

export type InsertAdViewHistory = z.infer<typeof insertAdViewHistorySchema>;
export type AdViewHistory = typeof adViewHistory.$inferSelect;
