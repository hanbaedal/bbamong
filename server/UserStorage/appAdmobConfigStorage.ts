import { AppAdmobConfigModel } from "./db";
import { isGoogleTestAdMobId, trimAdMobId } from "@shared/admobConstants";

export interface AppAdmobConfig {
  id: string;
  androidAppId: string;
  iosAppId: string;
  androidInterstitialAdUnitId: string;
  iosInterstitialAdUnitId: string;
  androidRewardedAdUnitId: string;
  iosRewardedAdUnitId: string;
  androidBannerAdUnitId: string;
  iosBannerAdUnitId: string;
  updatedAt: Date;
}

export interface AdmobProductionReadiness {
  androidAppIdSet: boolean;
  iosAppIdSet: boolean;
  androidInterstitialSet: boolean;
  iosInterstitialSet: boolean;
  androidRewardedSet: boolean;
  iosRewardedSet: boolean;
  androidBannerSet: boolean;
  iosBannerSet: boolean;
  usingTestIds: boolean;
  readyForAndroidProduction: boolean;
  readyForIosProduction: boolean;
}

const DEFAULTS = {
  id: "default",
  androidAppId: "",
  iosAppId: "",
  androidInterstitialAdUnitId: "",
  iosInterstitialAdUnitId: "",
  androidRewardedAdUnitId: "",
  iosRewardedAdUnitId: "",
  androidBannerAdUnitId: "",
  iosBannerAdUnitId: "",
};

function normalizeConfig(doc: Record<string, unknown>): AppAdmobConfig {
  return {
    ...DEFAULTS,
    ...doc,
    updatedAt: (doc.updatedAt as Date | undefined) ?? new Date(),
  } as AppAdmobConfig;
}

export function evaluateAdmobProductionReadiness(config: AppAdmobConfig): AdmobProductionReadiness {
  const ids = [
    config.androidAppId,
    config.iosAppId,
    config.androidInterstitialAdUnitId,
    config.iosInterstitialAdUnitId,
    config.androidRewardedAdUnitId,
    config.iosRewardedAdUnitId,
    config.androidBannerAdUnitId,
    config.iosBannerAdUnitId,
  ];
  const usingTestIds = ids.some((id) => isGoogleTestAdMobId(id));

  const androidAppIdSet = !!trimAdMobId(config.androidAppId);
  const androidInterstitialSet = !!trimAdMobId(config.androidInterstitialAdUnitId);
  const androidRewardedSet = !!trimAdMobId(config.androidRewardedAdUnitId);

  const iosAppIdSet = !!trimAdMobId(config.iosAppId);
  const iosInterstitialSet = !!trimAdMobId(config.iosInterstitialAdUnitId);
  const iosRewardedSet = !!trimAdMobId(config.iosRewardedAdUnitId);

  return {
    androidAppIdSet,
    iosAppIdSet,
    androidInterstitialSet,
    iosInterstitialSet,
    androidRewardedSet,
    iosRewardedSet,
    androidBannerSet: !!trimAdMobId(config.androidBannerAdUnitId),
    iosBannerSet: !!trimAdMobId(config.iosBannerAdUnitId),
    usingTestIds,
    readyForAndroidProduction:
      androidAppIdSet &&
      androidInterstitialSet &&
      androidRewardedSet &&
      !usingTestIds,
    readyForIosProduction:
      iosAppIdSet && iosInterstitialSet && iosRewardedSet && !usingTestIds,
  };
}

export class AppAdmobConfigStorage {
  async getConfig(): Promise<AppAdmobConfig> {
    let doc = await AppAdmobConfigModel.findOne({ id: "default" }).lean();
    if (!doc) {
      const created = await AppAdmobConfigModel.create({
        ...DEFAULTS,
        updatedAt: new Date(),
      });
      doc = created.toObject();
    }
    return normalizeConfig(doc as Record<string, unknown>);
  }

  async updateConfig(data: Partial<Omit<AppAdmobConfig, "id" | "updatedAt">>): Promise<AppAdmobConfig> {
    const doc = await AppAdmobConfigModel.findOneAndUpdate(
      { id: "default" },
      { ...data, updatedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return normalizeConfig(doc as Record<string, unknown>);
  }

  async getPublicConfig() {
    const config = await this.getConfig();
    return {
      androidAppId: trimAdMobId(config.androidAppId),
      iosAppId: trimAdMobId(config.iosAppId),
      androidInterstitialAdUnitId: trimAdMobId(config.androidInterstitialAdUnitId),
      iosInterstitialAdUnitId: trimAdMobId(config.iosInterstitialAdUnitId),
      androidRewardedAdUnitId: trimAdMobId(config.androidRewardedAdUnitId),
      iosRewardedAdUnitId: trimAdMobId(config.iosRewardedAdUnitId),
      androidBannerAdUnitId: trimAdMobId(config.androidBannerAdUnitId),
      iosBannerAdUnitId: trimAdMobId(config.iosBannerAdUnitId),
    };
  }
}

export const appAdmobConfigStorage = new AppAdmobConfigStorage();
