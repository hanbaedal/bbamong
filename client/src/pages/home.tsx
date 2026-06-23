import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { useUserAssets } from "@/contexts/UserAssetContext";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { getFullUrl } from "@/lib/queryClient";
import { ChevronRight } from "lucide-react";

interface HomePageSettings {
  greetingPrefix: string;
  subGreeting: string;
  buttonText: string;
  buttonEnabled: boolean;
  showDate: boolean;
  gameGuideTitle: string;
  gameGuideSummary: string;
  gameGuideEnabled: boolean;
  goodsSectionTitle: string;
  goodsSectionEnabled: boolean;
  introVideoUrl?: string;
}

interface HomePageContent {
  settings: HomePageSettings;
}

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { assets } = useUserAssets();
  const [formattedDate, setFormattedDate] = useState("");

  const { data: content } = useQuery<HomePageContent>({
    queryKey: ["/api/homepage/content"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/homepage/content"));
      if (!res.ok) throw new Error("Failed to load homepage");
      return res.json();
    },
    staleTime: 60_000,
  });

  const settings = content?.settings;

  const greetingPrefix = settings?.greetingPrefix ?? "안녕하세요";
  const subGreeting = settings?.subGreeting ?? "";
  const buttonText = settings?.buttonText ?? "경기 참여하기";
  const buttonEnabled = settings?.buttonEnabled ?? true;
  const showDate = settings?.showDate ?? true;

  useEffect(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    };
    const localeDate = now.toLocaleDateString("ko-KR", options);
    const parts = localeDate.split(" ");
    const year = parts[0].replace(".", "년");
    const month = parts[1].replace(".", "월");
    const day = parts[2].replace(".", "일");
    const weekday = parts[3];
    setFormattedDate(`${year} ${month} ${day} ${weekday}`);
  }, []);

  return (
    <div className="h-app-screen bg-[#111111] flex flex-col">
      <PageHeader title="" />

      <div className="flex-1 overflow-y-scroll-touch px-5 pb-bottom-nav">
        {/* 인사 + 참여 버튼 */}
        <div className="flex flex-col items-center pt-4 pb-6">
          <div className="text-center mb-4">
            {showDate && (
              <p className="text-white text-[14px] mb-1">{formattedDate}</p>
            )}
            <p className="text-[#6B6B6B] text-[20px]">
              {user ? `${greetingPrefix} ${user.name}님` : greetingPrefix}
            </p>
            {subGreeting.trim() && (
              <p className="text-[#6B6B6B] text-[14px] mt-2">{subGreeting}</p>
            )}
          </div>

          <div className="w-[130px] h-[200px] mb-6 flex items-center justify-center">
            <img
              src={assets.mainLogo}
              alt=""
              className="w-full h-full object-contain"
            />
          </div>

          {buttonEnabled && (
            <button
              data-testid="button-start-prediction"
              onClick={() => setLocation("/prediction")}
              className="w-auto max-w-[220px] px-5 py-2 bg-[#CDFF00] text-black font-bold rounded-[6px] flex items-center justify-center gap-2"
            >
              <img src={assets.baseballLogo} alt="" className="w-4 h-4 object-contain" />
              {buttonText}
            </button>
          )}
        </div>

        {/* 야구 예측 게임 소개 */}
        {settings?.gameGuideEnabled && (
          <section className="mb-8">
            <h2 className="text-white text-base font-bold mb-3">
              {settings.gameGuideTitle}
            </h2>
            <button
              type="button"
              onClick={() => setLocation("/home/game-guide")}
              className="w-full text-left p-4 rounded-lg bg-[#1A1A1A] border border-[#333] flex items-center gap-3"
            >
              <img
                src={assets.baseballLogo}
                alt=""
                className="w-10 h-10 object-contain flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[#D5D5D5] text-sm line-clamp-2">
                  {settings.gameGuideSummary ||
                    "실시간 야구 경기를 예측하고 포인트를 획득하세요."}
                </p>
                <p className="text-[#CDFF00] text-xs mt-2">자세히 보기</p>
              </div>
              <ChevronRight className="w-5 h-5 text-[#666] flex-shrink-0" />
            </button>
          </section>
        )}

        {/* 홈페이지 쇼핑몰 (회사소개 영상 → 카테고리) */}
        {settings?.goodsSectionEnabled && (
          <section className="mb-6">
            <button
              type="button"
              onClick={() => setLocation("/home/shop")}
              className="w-full text-left rounded-lg overflow-hidden bg-[#1A1A1A] border border-[#333] flex items-center gap-3 p-4"
            >
              <div className="w-12 h-12 rounded-xl bg-[#252525] border border-[#333] flex items-center justify-center flex-shrink-0">
                <img
                  src={assets.mainLogo}
                  alt=""
                  className="w-8 h-8 object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold">
                  {settings.goodsSectionTitle || "홈페이지"}
                </p>
                <p className="text-[#888] text-[11px] mt-1">
                  회사소개 영상 후 쇼핑몰 카테고리
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-[#666] flex-shrink-0" />
            </button>
          </section>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
