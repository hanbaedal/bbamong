/**
 * AdMob 앱/광고 단위 ID를 MongoDB AppAdmobConfig에 저장합니다.
 * 사용: MONGODB_URI 가 .env 또는 환경 변수에 있을 때
 *   node scripts/seed-admob-config.mjs
 */
import "dotenv/config";
import mongoose from "mongoose";

const APP_ID_ANDROID = "ca-app-pub-1965347543973162~9901546913";
const INTERSTITIAL_ANDROID = "ca-app-pub-1965347543973162/9657050041";
const REWARDED_ANDROID = "ca-app-pub-1965347543973162/8343968379";
const BANNER_ANDROID = "ca-app-pub-1965347543973162/8281489271";

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error("MONGODB_URI 가 없습니다. Replit Secrets 또는 .env 를 확인하세요.");
  process.exit(1);
}

const schema = new mongoose.Schema(
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
  { versionKey: false, collection: "appadmobconfigs" },
);

async function main() {
  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME || "ppamong",
  });

  const Model = mongoose.models.AppAdmobConfigSeed || mongoose.model("AppAdmobConfigSeed", schema);

  const doc = await Model.findOneAndUpdate(
    { id: "default" },
    {
      androidAppId: APP_ID_ANDROID,
      androidInterstitialAdUnitId: INTERSTITIAL_ANDROID,
      androidRewardedAdUnitId: REWARDED_ANDROID,
      androidBannerAdUnitId: BANNER_ANDROID,
      updatedAt: new Date(),
    },
    { new: true, upsert: true },
  ).lean();

  console.log("AppAdmobConfig 저장 완료:");
  console.log("  androidAppId:", doc.androidAppId);
  console.log("  androidInterstitialAdUnitId:", doc.androidInterstitialAdUnitId);
  console.log("  androidRewardedAdUnitId:", doc.androidRewardedAdUnitId);
  console.log("  androidBannerAdUnitId:", doc.androidBannerAdUnitId);
  console.log("");
  console.log("Android 실운영 AdMob 3종 + App ID 설정 완료. 앱 재시작 또는 seed 후 APK 빌드하세요.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
