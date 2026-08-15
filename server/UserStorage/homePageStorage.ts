import { HomePageSettingsModel } from "./db";
import { goodsStorage } from "./goodsStorage";
import { resolveShopSectionTitle } from "@shared/shopBranding";
import {
  DEFAULT_GAME_GUIDE_CONTENT,
  DEFAULT_GAME_GUIDE_SUMMARY,
  DEFAULT_GAME_GUIDE_TITLE,
} from "@shared/defaultGameGuide";

/** 예전 기본 요약 — getSettings에서도 새 문구로 치환 */
const LEGACY_GAME_GUIDE_SUMMARIES = new Set([
  "실시간 경기를 예측하고 포인트를 획득하는 야구 예측 게임입니다.",
]);

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
  shopInquiryEmail: string;
  shopInquiryPhone: string;
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
  buttonText: "예측게임 하러가기",
  buttonEnabled: true,
  showDate: true,
  gameGuideTitle: DEFAULT_GAME_GUIDE_TITLE,
  gameGuideSummary: DEFAULT_GAME_GUIDE_SUMMARY,
  gameGuideContent: DEFAULT_GAME_GUIDE_CONTENT,
  gameGuideEnabled: true,
  gameGuideImageUrl: "",
  goodsSectionTitle: "PPAMONG 스포츠몰",
  goodsSectionEnabled: true,
  introVideoUrl: "/videos/company-intro.mp4",
  shopInquiryEmail: "",
  shopInquiryPhone: "",
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
    const rawSummary = String((doc as { gameGuideSummary?: string }).gameGuideSummary ?? "").trim();
    const rawContent = String((doc as { gameGuideContent?: string }).gameGuideContent ?? "").trim();
    const rawTitle = String((doc as { gameGuideTitle?: string }).gameGuideTitle ?? "").trim();
    return {
      ...DEFAULT_SETTINGS,
      ...doc,
      gameGuideTitle: rawTitle || DEFAULT_GAME_GUIDE_TITLE,
      gameGuideSummary:
        !rawSummary || LEGACY_GAME_GUIDE_SUMMARIES.has(rawSummary)
          ? DEFAULT_GAME_GUIDE_SUMMARY
          : rawSummary,
      gameGuideContent: rawContent || DEFAULT_GAME_GUIDE_CONTENT,
      updatedAt: doc.updatedAt ?? new Date(),
    } as HomePageSettings;
  }

  async getPublicContent(): Promise<HomePageContent> {
    const [rawSettings, categories] = await Promise.all([
      this.getSettings(),
      goodsStorage.listCategories(true),
    ]);
    const settings = {
      ...rawSettings,
      goodsSectionTitle: resolveShopSectionTitle(rawSettings.goodsSectionTitle),
    };
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
