import mongoose, { Schema, type InferSchemaType } from "mongoose";

const counterSchema = new Schema({
  name: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 },
});
export const CounterModel = mongoose.model("Counter", counterSchema);

const userSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, default: null },
    phone: { type: String, default: null, unique: true, sparse: true },
    email: { type: String, default: null },
    provider: { type: String, default: "local" },
    providerId: { type: String, default: null },
    inviteCode: { type: String, default: null, unique: true, sparse: true },
    referralCode: { type: String, default: null },
    verificationCode: { type: String, default: null },
    verificationCodeExpiry: { type: Date, default: null },
    points: { type: Number, default: 0 },
    lastAttendanceDate: { type: Date, default: null },
    isSuspended: { type: Number, default: 0 },
    suspendedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    isOnline: { type: Number, default: 0 },
    lastLogin: { type: Date, default: null },
    lastLogout: { type: Date, default: null },
    lastActive: { type: Date, default: null },
    totalDonationAmount: { type: Number, default: 0 },
  },
  { versionKey: false },
);
userSchema.index({ provider: 1, providerId: 1 }, { unique: true, sparse: true });
export const UserModel = mongoose.model("User", userSchema);

const stadiumSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const StadiumModel = mongoose.model("Stadium", stadiumSchema);

const matchSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    stadiumId: { type: Number, required: true },
    matchDate: { type: String, default: null },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    matchStatus: { type: String, default: "scheduled" },
    currentRound: { type: Number, default: 1 },
    predictionEnabled: { type: Boolean, default: false },
  },
  { versionKey: false },
);
export const MatchModel = mongoose.model("Match", matchSchema);

const attendanceSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: String, required: true },
    attendanceDate: { type: Date, required: true },
  },
  { versionKey: false },
);
export const AttendanceRecordModel = mongoose.model("AttendanceRecord", attendanceSchema);

const postSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    authorId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    viewCount: { type: Number, default: 0 },
  },
  { versionKey: false },
);
export const PostModel = mongoose.model("Post", postSchema);

const commentSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    postId: { type: Number, required: true },
    content: { type: String, required: true },
    authorId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const CommentModel = mongoose.model("Comment", commentSchema);

const pointTransactionSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: String, required: true },
    transactionType: { type: String, required: true },
    amount: { type: Number, required: true },
    balance: { type: Number, required: true },
    description: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const PointTransactionModel = mongoose.model("PointTransaction", pointTransactionSchema);

const inquirySchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: String, required: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    status: { type: String, default: "pending" },
    response: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const InquiryModel = mongoose.model("Inquiry", inquirySchema);

const noticeSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    tag: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    displayOrder: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const NoticeModel = mongoose.model("Notice", noticeSchema);

const termSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const TermModel = mongoose.model("Term", termSchema);

const faqSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const FaqModel = mongoose.model("Faq", faqSchema);

const ebookSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const EbookModel = mongoose.model("Ebook", ebookSchema);

const ebookPurchaseSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: String, required: true },
    ebookId: { type: Number, required: true },
    purchasedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const EbookPurchaseModel = mongoose.model("EbookPurchase", ebookPurchaseSchema);

const adminUserSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    department: { type: String, default: null },
    position: { type: String, default: null },
    phone: { type: String, required: true },
    userType: { type: String, default: "일반어드민" },
    approvalStatus: { type: String, default: "대기중" },
    status: { type: String, default: "활성화" },
    lastLogin: { type: Date, default: null },
    lastLogout: { type: Date, default: null },
    logoutAllowed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    username: { type: String, required: true, unique: true },
    assignedMatchNumber: { type: String, default: null },
    operatorSlot: { type: Number, default: null },
    dailyPasswordPlain: { type: String, default: "" },
    dailyPasswordDate: { type: String, default: "" },
  },
  { versionKey: false },
);
export const AdminUserModel = mongoose.model("AdminUser", adminUserSchema);

const predictionSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: String, required: true },
    matchId: { type: String, required: true },
    roundNumber: { type: Number, default: 1 },
    prediction: { type: String, required: true },
    amount: { type: Number, default: 100 },
    status: { type: String, default: "pending" },
    result: { type: String, default: null },
    wonAmount: { type: Number, default: 0 },
    donatedAmount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
predictionSchema.index({ userId: 1, matchId: 1, roundNumber: 1 }, { unique: true });
export const PredictionModel = mongoose.model("Prediction", predictionSchema);

const roundStatisticsSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    matchId: { type: String, required: true },
    roundNumber: { type: Number, required: true },
    totalParticipants: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    totalWinners: { type: Number, default: 0 },
    predictionStartTime: { type: Date, default: null },
    predictionStopTime: { type: Date, default: null },
    isPredictionStarted: { type: Boolean, default: false },
    isPredictionStopped: { type: Boolean, default: false },
    isResultSent: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const RoundStatisticsModel = mongoose.model("RoundStatistics", roundStatisticsSchema);

const waitingScreenSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    videoName: { type: String, required: true },
    displayDuration: { type: Number, default: 4 },
    videoUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const WaitingScreenModel = mongoose.model("WaitingScreen", waitingScreenSchema);

const advertisementSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    videoName: { type: String, required: true },
    earnedPoints: { type: Number, default: 4 },
    videoUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const AdvertisementModel = mongoose.model("Advertisement", advertisementSchema);

const adViewHistorySchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: String, required: true },
    advertisementId: { type: Number, required: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const AdViewHistoryModel = mongoose.model("AdViewHistory", adViewHistorySchema);

const homePageSettingsSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, default: "default" },
    greetingPrefix: { type: String, default: "안녕하세요" },
    subGreeting: { type: String, default: "" },
    buttonText: { type: String, default: "경기 참여하기" },
    buttonEnabled: { type: Boolean, default: true },
    showDate: { type: Boolean, default: true },
    gameGuideTitle: { type: String, default: "야구 예측 게임이란?" },
    gameGuideSummary: { type: String, default: "실시간 경기를 예측하고 포인트를 획득하는 야구 예측 게임입니다." },
    gameGuideContent: { type: String, default: "" },
    gameGuideEnabled: { type: Boolean, default: true },
    gameGuideImageUrl: { type: String, default: "" },
    goodsSectionTitle: { type: String, default: "PPAMONG 굿즈" },
    goodsSectionEnabled: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const HomePageSettingsModel = mongoose.model("HomePageSettings", homePageSettingsSchema);

const goodsCategorySchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const GoodsCategoryModel = mongoose.model("GoodsCategory", goodsCategorySchema);

const goodsProductSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    categoryId: { type: Number, required: true },
    name: { type: String, required: true },
    summary: { type: String, default: "" },
    detailContent: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    priceLabel: { type: String, default: "" },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
goodsProductSchema.index({ categoryId: 1, displayOrder: 1 });
export const GoodsProductModel = mongoose.model("GoodsProduct", goodsProductSchema);

export type MongoUser = InferSchemaType<typeof userSchema>;
