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
    passwordPlain: { type: String, default: "" },
    /** default: null 이면 insert 시 phone:null이 여러 건 생겨 sparse unique(phone_1) 충돌 */
    phone: { type: String, unique: true, sparse: true },
    email: { type: String, default: null },
    provider: { type: String, default: "local" },
    providerId: { type: String },
    inviteCode: { type: String, unique: true, sparse: true },
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
    registrationOrder: { type: Number, default: null },
    apiSportsGameId: { type: Number, default: null },
    apiSportsHomeTeam: { type: String, default: null },
    apiSportsAwayTeam: { type: String, default: null },
    liveScoreboard: { type: Schema.Types.Mixed, default: null },
    lastInningKey: { type: String, default: null },
    controlMode: { type: String, default: "auto" },
    sideBetsLocked: { type: Boolean, default: false },
    /** 운영자 진행 기준 이닝 (1=1회) */
    gameInning: { type: Number, default: 1 },
    /** top=초(원정 공격), bottom=말(홈 공격) */
    inningHalf: { type: String, default: "top" },
    /** 현재 공수에서 몇 번째 타자 */
    batterIndexInHalf: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const MatchModel = mongoose.model("Match", matchSchema);

const apiSportsScheduleCacheSchema = new Schema(
  {
    matchDate: { type: String, required: true },
    apiSportsGameId: { type: Number, required: true },
    season: { type: Number, default: null },
    leagueId: { type: Number, default: 5 },
    date: { type: String, required: true },
    time: { type: String, default: "" },
    timestamp: { type: Number, default: 0 },
    statusShort: { type: String, default: "NS" },
    statusLong: { type: String, default: "" },
    homeTeamId: { type: Number, default: null },
    homeTeamName: { type: String, required: true },
    awayTeamId: { type: Number, default: null },
    awayTeamName: { type: String, required: true },
    venueName: { type: String, default: "" },
    venueCity: { type: String, default: "" },
    homeScore: { type: Number, default: 0 },
    awayScore: { type: Number, default: 0 },
    fetchedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
apiSportsScheduleCacheSchema.index({ matchDate: 1, apiSportsGameId: 1 }, { unique: true });
apiSportsScheduleCacheSchema.index({ matchDate: 1 });
export const ApiSportsScheduleCacheModel = mongoose.model(
  "ApiSportsScheduleCache",
  apiSportsScheduleCacheSchema,
);

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
    lastLoginIp: { type: String, default: "" },
    lastLoginRegion: { type: String, default: "" },
    logoutAllowed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    username: { type: String, required: true, unique: true },
    assignedMatchNumber: { type: String, default: null },
    operatorSlot: { type: Number, default: null },
    dailyPasswordPlain: { type: String, default: "" },
    dailyPasswordDate: { type: String, default: "" },
    /** 카톡용 일회용 자동 로그인 링크 토큰 (사용·만료·재발급 시 비움) */
    loginLinkToken: { type: String, default: "" },
    loginLinkExpiresAt: { type: Date, default: null },
    /** true: 오늘 경기 할당 + API 스코어 폴링 대상 */
    apiSyncEnabled: { type: Boolean, default: true },
    passwordPlain: { type: String, default: "" },
    notes: { type: String, default: "" },
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

const matchSideBetSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: String, required: true },
    matchId: { type: String, required: true },
    type: { type: String, required: true, enum: ["winner", "score"] },
    winnerPick: { type: String, enum: ["home", "away"], default: null },
    homeScorePick: { type: Number, default: null },
    awayScorePick: { type: Number, default: null },
    amount: { type: Number, required: true },
    odds: { type: Number, required: true },
    status: { type: String, default: "pending" },
    wonAmount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
matchSideBetSchema.index({ userId: 1, matchId: 1, type: 1 }, { unique: true });
export const MatchSideBetModel = mongoose.model("MatchSideBet", matchSideBetSchema);

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
    goodsSectionTitle: { type: String, default: "PPAMONG 스포츠몰" },
    goodsSectionEnabled: { type: Boolean, default: true },
    introVideoUrl: { type: String, default: "/videos/company-intro.mp4" },
    shopInquiryEmail: { type: String, default: "" },
    shopInquiryPhone: { type: String, default: "" },
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
    priceAmount: { type: Number, default: 0 },
    originalPriceAmount: { type: Number, default: 0 },
    brand: { type: String, default: "" },
    color: { type: String, default: "" },
    size: { type: String, default: "" },
    stockQuantity: { type: Number, default: -1 },
    variants: {
      type: [
        {
          color: { type: String, default: "" },
          size: { type: String, default: "" },
          stock: { type: Number, default: 0, min: 0 },
        },
      ],
      default: [],
    },
    fulfillmentType: { type: String, enum: ["stock", "procure"], default: "stock" },
    procureNotice: { type: String, default: "" },
    reorderPoint: { type: Number, default: 0 },
    optimalStock: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    shippingLabel: { type: String, default: "무료배송" },
    detailImages: { type: [String], default: [] },
    purchaseUrl: { type: String, default: "" },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
goodsProductSchema.index({ categoryId: 1, displayOrder: 1 });
export const GoodsProductModel = mongoose.model("GoodsProduct", goodsProductSchema);

const appAdmobConfigSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, default: "default" },
    androidAppId: { type: String, default: "" },
    iosAppId: { type: String, default: "" },
    androidInterstitialAdUnitId: { type: String, default: "" },
    iosInterstitialAdUnitId: { type: String, default: "" },
    androidRewardedAdUnitId: { type: String, default: "" },
    iosRewardedAdUnitId: { type: String, default: "" },
    androidBannerAdUnitId: { type: String, default: "" },
    iosBannerAdUnitId: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const AppAdmobConfigModel = mongoose.model("AppAdmobConfig", appAdmobConfigSchema);

const shopInquirySchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    productId: { type: Number, required: true },
    productName: { type: String, required: true },
    customerName: { type: String, required: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    message: { type: String, default: "" },
    response: { type: String, default: "" },
    respondedAt: { type: Date },
    status: { type: String, enum: ["pending", "done"], default: "pending" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
shopInquirySchema.index({ status: 1, createdAt: -1 });
export const ShopInquiryModel = mongoose.model("ShopInquiry", shopInquirySchema);

const mallProductReviewSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    productId: { type: Number, required: true },
    authorName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    content: { type: String, default: "" },
    isVisible: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
mallProductReviewSchema.index({ productId: 1, isVisible: 1, createdAt: -1 });
export const MallProductReviewModel = mongoose.model("MallProductReview", mallProductReviewSchema);

const mallOrderItemSchema = new Schema(
  {
    productId: { type: Number, required: true },
    productName: { type: String, required: true },
    priceAmount: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    imageUrl: { type: String, default: "" },
    color: { type: String, default: "" },
    size: { type: String, default: "" },
  },
  { _id: false },
);

const mallOrderSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: String, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    shippingAddress: { type: String, required: true },
    memo: { type: String, default: "" },
    items: { type: [mallOrderItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "preparing", "confirmed", "shipped", "cancelled"],
      default: "pending",
    },
    courierCompany: { type: String, default: "" },
    trackingNumber: { type: String, default: "" },
    shippedAt: { type: Date },
    stockRestored: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
mallOrderSchema.index({ userId: 1, createdAt: -1 });
mallOrderSchema.index({ status: 1, createdAt: -1 });
export const MallOrderModel = mongoose.model("MallOrder", mallOrderSchema);

const mallWarehouseSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const MallWarehouseModel = mongoose.model("MallWarehouse", mallWarehouseSchema);

const mallLocationSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    warehouseId: { type: Number, required: true },
    code: { type: String, required: true },
    description: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
mallLocationSchema.index({ warehouseId: 1, code: 1 }, { unique: true });
export const MallLocationModel = mongoose.model("MallLocation", mallLocationSchema);

const mallStockMovementSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    warehouseId: { type: Number, required: true },
    locationId: { type: Number },
    productId: { type: Number, required: true },
    productName: { type: String, default: "" },
    color: { type: String, default: "" },
    size: { type: String, default: "" },
    quantity: { type: Number, required: true },
    movementType: { type: String, required: true },
    referenceId: { type: Number },
    memo: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
mallStockMovementSchema.index({ productId: 1, createdAt: -1 });
export const MallStockMovementModel = mongoose.model("MallStockMovement", mallStockMovementSchema);

const mallSupplierSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    contactName: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    memo: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
export const MallSupplierModel = mongoose.model("MallSupplier", mallSupplierSchema);

const mallPurchaseLineSchema = new Schema(
  {
    productId: { type: Number, required: true },
    productName: { type: String, required: true },
    color: { type: String, default: "" },
    size: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const mallPurchaseOrderSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    supplierId: { type: Number, required: true },
    supplierName: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "ordered", "partial", "received", "cancelled"],
      default: "draft",
    },
    lines: { type: [mallPurchaseLineSchema], default: [] },
    memo: { type: String, default: "" },
    orderedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
mallPurchaseOrderSchema.index({ status: 1, createdAt: -1 });
export const MallPurchaseOrderModel = mongoose.model("MallPurchaseOrder", mallPurchaseOrderSchema);

export type MongoUser = InferSchemaType<typeof userSchema>;
