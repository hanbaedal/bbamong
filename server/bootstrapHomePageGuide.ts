import { HomePageSettingsModel } from "./UserStorage/db";
import {
  DEFAULT_GAME_GUIDE_CONTENT,
  DEFAULT_GAME_GUIDE_SUMMARY,
  DEFAULT_GAME_GUIDE_TITLE,
} from "@shared/defaultGameGuide";

/** 예전 기본 요약 — 새 문구로 교체 */
const LEGACY_GAME_GUIDE_SUMMARIES = new Set([
  "실시간 경기를 예측하고 포인트를 획득하는 야구 예측 게임입니다.",
]);

/**
 * 홈 「야구 예측 게임이란?」 기본 문구가 비어 있거나 레거시 요약이면 최신 기본값으로 채웁니다.
 * 관리자가 직접 쓴 긴 본문은 덮어쓰지 않습니다.
 */
export async function ensureHomePageGameGuide(): Promise<void> {
  try {
    const doc = await HomePageSettingsModel.findOne({ id: "default" }).lean();
    if (!doc) {
      await HomePageSettingsModel.create({
        id: "default",
        gameGuideTitle: DEFAULT_GAME_GUIDE_TITLE,
        gameGuideSummary: DEFAULT_GAME_GUIDE_SUMMARY,
        gameGuideContent: DEFAULT_GAME_GUIDE_CONTENT,
        gameGuideEnabled: true,
        updatedAt: new Date(),
      });
      console.log("[Bootstrap] 홈 게임 소개 기본 문서 생성");
      return;
    }

    const updates: Record<string, unknown> = {};
    const summary = String(doc.gameGuideSummary ?? "").trim();
    const content = String(doc.gameGuideContent ?? "").trim();
    const title = String(doc.gameGuideTitle ?? "").trim();

    if (!title) updates.gameGuideTitle = DEFAULT_GAME_GUIDE_TITLE;
    if (!summary || LEGACY_GAME_GUIDE_SUMMARIES.has(summary)) {
      updates.gameGuideSummary = DEFAULT_GAME_GUIDE_SUMMARY;
    }
    if (!content) {
      updates.gameGuideContent = DEFAULT_GAME_GUIDE_CONTENT;
    } else if (content.includes("「딜레이 예측게임」은 준비 중입니다.")) {
      updates.gameGuideContent = content.replaceAll(
        "「딜레이 예측게임」은 준비 중입니다.",
        "「딜레이 예측게임」은 경기가 시작된 뒤에 타석이 자동으로 열립니다.",
      );
    }

    if (Object.keys(updates).length === 0) return;

    updates.updatedAt = new Date();
    await HomePageSettingsModel.updateOne({ id: "default" }, { $set: updates });
    console.log("[Bootstrap] 홈 게임 소개 기본 문구 갱신:", Object.keys(updates).join(", "));
  } catch (err) {
    console.error("[Bootstrap] 홈 게임 소개 갱신 실패:", err);
  }
}
