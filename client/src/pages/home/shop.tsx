import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { getFullUrl } from "@/lib/queryClient";
import { getShopCategoryIcon } from "@/lib/shopCategoryIcons";

interface HomePageSettings {
  goodsSectionTitle: string;
  introVideoUrl: string;
}

interface GoodsCategory {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
}

interface HomePageContent {
  settings: HomePageSettings;
  categories: GoodsCategory[];
}

const DEFAULT_INTRO_VIDEO = "/videos/company-intro.mp4";

export default function HomeShopPage() {
  const [, setLocation] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showShop, setShowShop] = useState(false);

  const { data: content, isLoading } = useQuery<HomePageContent>({
    queryKey: ["/api/homepage/content"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/homepage/content"));
      if (!res.ok) throw new Error("Failed to load homepage");
      return res.json();
    },
    staleTime: 60_000,
  });

  const settings = content?.settings;
  const categories = content?.categories ?? [];
  const introVideoUrl = settings?.introVideoUrl?.trim() || DEFAULT_INTRO_VIDEO;
  const shopTitle = settings?.goodsSectionTitle?.trim() || "홈페이지";

  useEffect(() => {
    if (!introVideoUrl) {
      setShowShop(true);
    }
  }, [introVideoUrl]);

  const openShop = () => setShowShop(true);

  if (!showShop) {
    return (
      <div className="h-app-screen bg-black flex flex-col">
        <div className="flex-shrink-0 flex items-center justify-between px-4 h-12">
          <button
            type="button"
            onClick={() => setLocation("/home")}
            className="p-1 text-white"
            aria-label="뒤로"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span className="text-white text-sm font-medium">{shopTitle}</span>
          <button
            type="button"
            onClick={openShop}
            className="text-[#CDFF00] text-xs px-2 py-1"
          >
            건너뛰기
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center px-2 pb-4 min-h-0">
          <video
            ref={videoRef}
            src={introVideoUrl}
            className="w-full max-h-full object-contain"
            playsInline
            autoPlay
            controls
            onEnded={openShop}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-app-screen bg-[#111111] flex flex-col">
      <PageHeader
        title={shopTitle}
        leftAction={
          <button
            type="button"
            onClick={() => setLocation("/home")}
            className="p-1"
            aria-label="뒤로"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-scroll-touch px-4 pb-bottom-nav">
        <p className="text-[#888] text-[11px] text-center pt-2 pb-4">
          카테고리를 선택하세요 (상품 상세는 추후 제공)
        </p>

        {isLoading ? (
          <p className="text-[#666] text-sm text-center py-12">불러오는 중...</p>
        ) : categories.length === 0 ? (
          <p className="text-[#888] text-sm text-center py-12">준비 중입니다.</p>
        ) : (
          <div className="grid grid-cols-4 gap-x-2 gap-y-5 pb-6">
            {categories.map((cat) => {
              const Icon = getShopCategoryIcon(cat.name);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setLocation(`/home/goods/${cat.id}`)}
                  className="flex flex-col items-center gap-1.5 min-w-0"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#1A1A1A] border border-[#333] flex items-center justify-center">
                    {cat.imageUrl ? (
                      <img
                        src={cat.imageUrl}
                        alt=""
                        className="w-7 h-7 object-contain"
                      />
                    ) : (
                      <Icon className="w-6 h-6 text-[#CDFF00]" strokeWidth={1.5} />
                    )}
                  </div>
                  <span className="text-[#D5D5D5] text-[10px] leading-tight text-center line-clamp-2 w-full">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
