import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import ShopSiteHeader from "@/components/public/ShopSiteHeader";
import StaffAuthLinks from "@/components/public/StaffAuthLinks";
import ShopCategoryGrid from "@/components/goods/ShopCategoryGrid";
import { useSiteMode, useShopRoutes } from "@/contexts/SiteModeContext";
import { navigateToGame } from "@/lib/appNavigation";
import { resolveShopSectionTitle } from "@/lib/shopBranding";
import { getFullUrl } from "@/lib/queryClient";

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
  const shopTitle = resolveShopSectionTitle(settings?.goodsSectionTitle);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openShopGrid = startAtShop || params.get("shop") === "1";
    if (!introVideoUrl || openShopGrid) {
      setShowShop(true);
    }
  }, [introVideoUrl, startAtShop, location]);

  const openShop = () => setShowShop(true);
  const headerVariant = isPublic ? "public" : "member";

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

  const backAction = !isMainShopHome ? (
    <button
      type="button"
      onClick={() => setLocation(routes.home)}
      className="p-1 text-white flex-shrink-0"
      aria-label="뒤로"
    >
      <ChevronLeft className="w-6 h-6" />
    </button>
  ) : undefined;

  const shopBackAction = isMainShopHome ? (
    <button
      type="button"
      onClick={() => setShowShop(false)}
      className="p-1 text-white flex-shrink-0"
      aria-label="뒤로"
    >
      <ChevronLeft className="w-6 h-6" />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setLocation(routes.home)}
      className="p-1 text-white flex-shrink-0"
      aria-label="뒤로"
    >
      <ChevronLeft className="w-6 h-6" />
    </button>
  );

  if (!showShop) {
    return (
      <div className="h-app-screen bg-black flex flex-col">
        <ShopSiteHeader
          title={shopTitle}
          variant={headerVariant}
          authMode="staff"
          showAuthButton
          rightAction={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openShop}
                className="text-[#CDFF00] text-xs whitespace-nowrap px-2 py-1"
              >
                건너뛰기
              </button>
              {!isAdminPreview && <StaffAuthLinks />}
            </div>
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

  if (isPublic) {
    return (
      <div className="h-app-screen bg-[#111111] flex flex-col">
        <ShopSiteHeader title={shopTitle} variant="public" authMode="member" leftAction={backAction} />

        <div className="flex-1 overflow-y-scroll-touch px-4 pb-8">
          <p className="text-[#888] text-[11px] text-center pt-2 pb-1">
            카테고리를 선택하세요
          </p>
          <p className="text-[#666] text-[10px] text-center pb-4">
            구매·문의는 우측 「회원 로그인」 후 이용하세요
          </p>

          <ShopCategoryGrid
            categories={categories}
            isLoading={isLoading}
            onSelect={navigateCategory}
          />

          <div className="border-t border-[#333] pt-4 mt-2 text-center">
            <button
              type="button"
              onClick={() => navigateToGame()}
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
      <ShopSiteHeader
        title={shopTitle}
        variant="member"
        leftAction={shopBackAction}
        showAuthButton={!isAdminPreview}
      />

      <div className="flex-1 overflow-y-scroll-touch px-4 pb-8">
        <p className="text-[#888] text-[11px] text-center pt-2 pb-4">
          카테고리를 선택하세요
        </p>

        <ShopCategoryGrid
          categories={categories}
          isLoading={isLoading}
          onSelect={navigateCategory}
        />
      </div>
    </div>
  );
}
