import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import GameSplitLayout from "@/components/game/GameSplitLayout";
import LandscapeHubMenu from "@/components/landscape/LandscapeHubMenu";
import LandscapeGameContentPane from "@/components/landscape/LandscapeGameContentPane";
import { navigateUserApp } from "@/lib/landscapeSplitRoutes";
import {
  GAME_STORY_SECTIONS,
  gameStoryPath,
  getGameStorySection,
} from "@/lib/gameSplitConfig";

export default function GameStorySplitPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/game/story/:section");
  const sectionId = params?.section;
  const section = getGameStorySection(sectionId);
  const { user } = useUser();

  useEffect(() => {
    if (!sectionId || section.id !== sectionId) {
      setLocation(gameStoryPath(section.id));
    }
  }, [sectionId, section.id, setLocation]);

  const { data: predictionStats, isLoading: statsLoading } = useQuery<{
    statistics: { today?: { total: number; wins: number } };
  }>({
    queryKey: ["/api/users/predictions?page=1&limit=1"],
    enabled: Boolean(user),
    refetchOnMount: "always",
  });

  const todayStats = predictionStats?.statistics?.today;

  const leftHeader = (
    <div className="lscape-hub-stats">
      <span className="lscape-hub-stats__label">오늘 예측</span>
      <div className="lscape-hub-stats__row">
        {statsLoading ? (
          <span className="lscape-hub-stats__value">…</span>
        ) : (
          <>
            <span>
              참여 <strong>{todayStats?.total ?? 0}</strong>
            </span>
            <span className="lscape-hub-stats__sep">·</span>
            <span>
              성공 <strong>{todayStats?.wins ?? 0}</strong>
            </span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <GameSplitLayout
      activeMenu="story"
      title="내 이야기"
      theme="story"
      backTo="/prediction"
      testId="game-story-split"
      leftHeader={leftHeader}
      left={
        <LandscapeHubMenu
          theme="story"
          items={GAME_STORY_SECTIONS.map((s) => ({
            id: s.id,
            label: s.label,
            testId: s.testId,
          }))}
          activeId={section.id}
          onSelect={(id) => navigateUserApp(gameStoryPath(id), setLocation)}
        />
      }
      right={<LandscapeGameContentPane theme="story" component={section.component} />}
    />
  );
}
