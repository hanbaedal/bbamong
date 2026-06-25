import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import PublicSiteHeader from "@/components/public/PublicSiteHeader";
import { useSiteMode, useShopRoutes } from "@/contexts/SiteModeContext";
import { shopGridPath } from "@/lib/shopRoutes";
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

interface HomeShopPageProps {
  /** /shop 등에서 영상 없이 바로 카테고리 그리드 */
  startAtShop?: boolean;
}

export default function HomeShopPage({ startAtShop = false }: HomeShopPageProps) {
  const [location, setLocation] = useLocation();
  const siteMode = useSiteMode();
  const routes = useShopRoutes();
  const isPublic = siteMode === "public";
  const isAdminPreview = siteMode === "admin";
  const isMainShopHome = location === routes.home || location === routes.shop;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showShop, setShowShop] = useState(startAtShop);

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
    const params = new URLSearchParams(window.location.search);
    const openShopGrid = startAtShop || params.get("shop") === "1";
    if (!introVideoUrl || openShopGrid) {
      setShowShop(true);
    }
  }, [introVideoUrl, startAtShop, location]);

  const openShop = () => setShowShop(true);

  const navigateCategory = (categoryId: number) => {
    const goodsPath = routes.category(categoryId);
    if (isAdminPreview) {
      window.open(goodsPath, "_blank", "noopener,noreferrer");
      return;
    }
    if (isPublic) {
      setLocation(goodsPath);
      return;
    }
    window.location.assign(goodsPath);
  };

  if (!showShop) {
    if (isPublic) {
      return (
        <div className="h-app-screen bg-black flex flex-col">
          <PublicSiteHeader
            title={shopTitle}
            rightAction={
              <button
                type="button"
                onClick={openShop}
                className="text-[#CDFF00] text-xs whitespace-nowrap"
              >
                건너뛰기
              </button>
            }
          />
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
      <div className="h-app-screen bg-black flex flex-col">
        <div className="flex-shrink-0 flex items-center justify-between px-4 h-12">
          {isMainShopHome ? (
            <div className="w-10" />
          ) : (
            <button
              type="button"
              onClick={() => setLocation(routes.home)}
              className="p-1 text-white"
              aria-label="뒤로"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
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

  if (isPublic) {
    return (
      <div className="h-app-screen bg-[#111111] flex flex-col">
        <PublicSiteHeader title={shopTitle} />

        <div className="flex-1 overflow-y-scroll-touch px-4 pb-8">
          <p className="text-[#888] text-[11px] text-center pt-2 pb-4">
            카테고리를 선택하세요
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
                    onClick={() => navigateCategory(cat.id)}
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

          <div className="border-t border-[#333] pt-4 mt-2 text-center">
            <button
              type="button"
              onClick={() => {
                window.location.assign("/login");
              }}
              className="text-[#CDFF00] text-xs underline"
            >
              야구 예측 게임 참여하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-app-screen bg-[#111111] flex flex-col">
      <PageHeader
        title={shopTitle}
        leftAction={
          isMainShopHome ? (
            <button
              type="button"
              onClick={() => setShowShop(false)}
              className="p-1"
              aria-label="뒤로"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setLocation(routes.home)}
              className="p-1"
              aria-label="뒤로"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )
        }
        showSettings={!isAdminPreview}
      />

      <div
        className={`flex-1 overflow-y-scroll-touch px-4 ${isAdminPreview ? "pb-6" : "pb-bottom-nav"}`}
      >
          <p className="text-[#888] text-[11px] text-center pt-2 pb-4">
            카테고리를 선택하세요
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
                  onClick={() => navigateCategory(cat.id)}
                  className="relative z-10 flex flex-col items-center gap-1.5 min-w-0"
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

      {!isAdminPreview && <BottomNavigation />}
    </div>
  );
}
