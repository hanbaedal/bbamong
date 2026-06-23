import { AppAdmobConfigModel } from "./db";

export interface AppAdmobConfig {
  id: string;
  androidInterstitialAdUnitId: string;
  iosInterstitialAdUnitId: string;
  updatedAt: Date;
}

const DEFAULTS = {
  id: "default",
  androidInterstitialAdUnitId: "",
  iosInterstitialAdUnitId: "",
};

export class AppAdmobConfigStorage {
  async getConfig(): Promise<AppAdmobConfig> {
    let doc = await AppAdmobConfigModel.findOne({ id: "default" }).lean();
    if (!doc) {
      doc = (
        await AppAdmobConfigModel.create({
          ...DEFAULTS,
          updatedAt: new Date(),
        })
      ).toObject();
    }
    return {
      ...DEFAULTS,
      ...doc,
      updatedAt: doc.updatedAt ?? new Date(),
    } as AppAdmobConfig;
  }

  async updateConfig(data: {
    androidInterstitialAdUnitId?: string;
    iosInterstitialAdUnitId?: string;
  }): Promise<AppAdmobConfig> {
    const doc = await AppAdmobConfigModel.findOneAndUpdate(
      { id: "default" },
      { ...data, updatedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return doc as AppAdmobConfig;
  }

  async getPublicConfig() {
    const config = await this.getConfig();
    return {
      androidInterstitialAdUnitId: config.androidInterstitialAdUnitId?.trim() || "",
      iosInterstitialAdUnitId: config.iosInterstitialAdUnitId?.trim() || "",
    };
  }
}

export const appAdmobConfigStorage = new AppAdmobConfigStorage();
