/** 딜레이 전용 컬렉션 — 실시간 Prediction / RoundStatistics / Match 를 쓰지 않는다. */
import mongoose, { Schema } from "mongoose";

const delayGameStateSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    sourceMatchId: { type: String, required: true, unique: true },
    roundNumber: { type: Number, default: 0 },
    phase: {
      type: String,
      enum: ["idle", "open", "closed", "ad", "ended"],
      default: "idle",
    },
    batterKey: { type: String, default: null },
    batterName: { type: String, default: null },
    pendingBatterName: { type: String, default: null },
    pendingBatterSince: { type: Number, default: null },
    lastHalf: { type: String, default: null },
    lastInning: { type: Number, default: null },
    lastOuts: { type: Number, default: null },
    lastPitcherName: { type: String, default: null },
    pendingResult: { type: String, default: null },
    pendingResultSince: { type: Number, default: null },
    settledResult: { type: String, default: null },
    openAtMs: { type: Number, default: null },
    adUntilMs: { type: Number, default: null },
    adReason: { type: String, default: null },
    adRewardKey: { type: String, default: null },
    seeded: { type: Boolean, default: false },
    seenOtherBatter: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: "delay_game_states" },
);
delayGameStateSchema.index({ sourceMatchId: 1 }, { unique: true });
export const DelayGameStateModel = mongoose.model("DelayGameState", delayGameStateSchema);

const delayPredictionSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: String, required: true },
    sourceMatchId: { type: String, required: true },
    roundNumber: { type: Number, required: true },
    prediction: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: "pending" },
    result: { type: String, default: null },
    wonAmount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: "delay_predictions" },
);
delayPredictionSchema.index(
  { userId: 1, sourceMatchId: 1, roundNumber: 1 },
  { unique: true },
);
export const DelayPredictionModel = mongoose.model("DelayPrediction", delayPredictionSchema);
