import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { getFullUrl } from "@/lib/queryClient";
import { navigateBackOrEmbed, requestHomeEmbedNavigate } from "@/lib/gameEmbed";
import {
  DEFAULT_GAME_GUIDE_CONTENT,
  DEFAULT_GAME_GUIDE_SUMMARY,
  DEFAULT_GAME_GUIDE_TITLE,
} from "@shared/defaultGameGuide";

interface HomePageSettings {
  gameGuideTitle: string;
  gameGuideSummary: string;
  gameGuideContent: string;
  gameGuideImageUrl: string;
}

export default function GameGuidePage() {
  const [, setLocation] = useLocation();

  const { data: settings, isLoading } = useQuery<HomePageSettings>({
    queryKey: ["/api/homepage-settings"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/homepage-settings"));
      if (!res.ok) throw new Error("load failed");
      return res.json();
    },
  });

  return (
    <div className="h-app-screen bg-[#111111] flex flex-col">
      <PageHeader
        title={settings?.gameGuideTitle?.trim() || DEFAULT_GAME_GUIDE_TITLE}
        showSettings={false}
        leftAction={
          <button
            type="button"
            onClick={() => navigateBackOrEmbed("/home", setLocation)}
            data-testid="button-back"
            className="p-1"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-scroll-touch px-5 pb-6 pt-4">
        {isLoading ? (
          <p className="text-[#888] text-sm">불러오는 중...</p>
        ) : (
          <>
            {settings?.gameGuideImageUrl && (
              <img
                src={settings.gameGuideImageUrl}
                alt=""
                className="w-full max-h-48 object-cover rounded-lg mb-4"
              />
            )}
            <p className="text-[#CDFF00] text-sm font-medium mb-4">
              {settings?.gameGuideSummary?.trim() || DEFAULT_GAME_GUIDE_SUMMARY}
            </p>
            <div className="text-[#D5D5D5] text-sm leading-relaxed whitespace-pre-wrap">
              {settings?.gameGuideContent?.trim() || DEFAULT_GAME_GUIDE_CONTENT}
            </div>
            <button
              type="button"
              onClick={() => requestHomeEmbedNavigate("/prediction", setLocation)}
              className="mt-8 w-full py-3 bg-[#CDFF00] text-black font-bold rounded-lg"
            >
              지금 경기 참여하기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
