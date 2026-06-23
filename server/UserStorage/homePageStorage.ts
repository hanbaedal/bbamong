import { HomePageSettingsModel } from "./db";
import { goodsStorage } from "./goodsStorage";

export interface HomePageSettings {
  id: string;
  greetingPrefix: string;
  subGreeting: string;
  buttonText: string;
  buttonEnabled: boolean;
  showDate: boolean;
  gameGuideTitle: string;
  gameGuideSummary: string;
  gameGuideContent: string;
  gameGuideEnabled: boolean;
  gameGuideImageUrl: string;
  goodsSectionTitle: string;
  goodsSectionEnabled: boolean;
  introVideoUrl: string;
  updatedAt: Date;
}

export interface HomePageContent {
  settings: HomePageSettings;
  categories: Awaited<ReturnType<typeof goodsStorage.listCategories>>;
}

const DEFAULT_SETTINGS: Omit<HomePageSettings, "updatedAt"> = {
  id: "default",
  greetingPrefix: "안녕하세요",
  subGreeting: "",
  buttonText: "경기 참여하기",
  buttonEnabled: true,
  showDate: true,
  gameGuideTitle: "야구 예측 게임이란?",
  gameGuideSummary: "실시간 경기를 예측하고 포인트를 획득하는 야구 예측 게임입니다.",
  gameGuideContent: "",
  gameGuideEnabled: true,
  gameGuideImageUrl: "",
  goodsSectionTitle: "홈페이지",
  goodsSectionEnabled: true,
  introVideoUrl: "/videos/company-intro.mp4",
};

export class HomePageStorage {
  async getSettings(): Promise<HomePageSettings> {
    let doc = await HomePageSettingsModel.findOne({ id: "default" }).lean();
    if (!doc) {
      doc = (
        await HomePageSettingsModel.create({
          ...DEFAULT_SETTINGS,
          updatedAt: new Date(),
        })
      ).toObject();
    }
    return {
      ...DEFAULT_SETTINGS,
      ...doc,
      updatedAt: doc.updatedAt ?? new Date(),
    } as HomePageSettings;
  }

  async getPublicContent(): Promise<HomePageContent> {
    const [settings, categories] = await Promise.all([
      this.getSettings(),
      goodsStorage.listCategories(true),
    ]);
    return { settings, categories };
  }

  async updateSettings(
    data: Partial<
      Omit<HomePageSettings, "id" | "updatedAt">
    >,
  ): Promise<HomePageSettings> {
    const doc = await HomePageSettingsModel.findOneAndUpdate(
      { id: "default" },
      { ...data, updatedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return doc as HomePageSettings;
  }
}

export const homePageStorage = new HomePageStorage();
