import { AppAdmobConfigModel } from "./db";

export interface AppAdmobConfig {
  id: string;
  androidInterstitialAdUnitId: string;
  iosInterstitialAdUnitId: string;
  androidRewardedAdUnitId: string;
  iosRewardedAdUnitId: string;
  androidBannerAdUnitId: string;
  iosBannerAdUnitId: string;
  updatedAt: Date;
}

const DEFAULTS = {
  id: "default",
  androidInterstitialAdUnitId: "",
  iosInterstitialAdUnitId: "",
  androidRewardedAdUnitId: "",
  iosRewardedAdUnitId: "",
  androidBannerAdUnitId: "",
  iosBannerAdUnitId: "",
};

export class AppAdmobConfigStorage {
  async getConfig(): Promise<AppAdmobConfig> {
    let doc = await AppAdmobConfigModel.findOne({ id: "default" }).lean();
    if (!doc) {
      const created = await AppAdmobConfigModel.create({
        ...DEFAULTS,
        updatedAt: new Date(),
      });
      doc = created.toObject() as typeof doc;
    }
    return {
      ...DEFAULTS,
      ...(doc as Record<string, unknown>),
      updatedAt: (doc as { updatedAt?: Date }).updatedAt ?? new Date(),
    } as AppAdmobConfig;
  }

  async updateConfig(data: Partial<Omit<AppAdmobConfig, "id" | "updatedAt">>): Promise<AppAdmobConfig> {
    const doc = await AppAdmobConfigModel.findOneAndUpdate(
      { id: "default" },
      { ...data, updatedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return { ...DEFAULTS, ...doc } as AppAdmobConfig;
  }

  async getPublicConfig() {
    const config = await this.getConfig();
    return {
      androidInterstitialAdUnitId: config.androidInterstitialAdUnitId?.trim() || "",
      iosInterstitialAdUnitId: config.iosInterstitialAdUnitId?.trim() || "",
      androidRewardedAdUnitId: config.androidRewardedAdUnitId?.trim() || "",
      iosRewardedAdUnitId: config.iosRewardedAdUnitId?.trim() || "",
      androidBannerAdUnitId: config.androidBannerAdUnitId?.trim() || "",
      iosBannerAdUnitId: config.iosBannerAdUnitId?.trim() || "",
    };
  }
}

export const appAdmobConfigStorage = new AppAdmobConfigStorage();
