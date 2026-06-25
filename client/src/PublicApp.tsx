import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient, getOrRefreshAccessToken } from "@/lib/queryClient";
import { UserAssetProvider } from "@/contexts/UserAssetContext";
import { SiteModeProvider } from "@/contexts/SiteModeContext";
import HomeShopPage from "@/pages/home/shop";
import GoodsCategoryPage from "@/pages/home/goods-category";
import GoodsDetailPage from "@/pages/home/goods-detail";
import NotFound from "@/pages/not-found";
import userFavicon from "@assets/user/user-mascot-favicon.png";

function mapPublicPathToMemberPath(path: string): string | null {
  if (path === "/" || path === "/shop") return "/home?shop=1";
  const categoryMatch = path.match(/^\/shop\/category\/(\d+)$/);
  if (categoryMatch) return `/home/goods/${categoryMatch[1]}`;
  const productMatch = path.match(/^\/shop\/product\/(\d+)$/);
  if (productMatch) return `/home/goods/item/${productMatch[1]}`;
  return null;
}

function MemberSessionRedirect() {
  const [location] = useLocation();

  useEffect(() => {
    void (async () => {
      try {
        const token = await getOrRefreshAccessToken();
        if (!token) return;

        const memberPath = mapPublicPathToMemberPath(location);
        if (memberPath && memberPath !== `${location}${window.location.search}`) {
          window.location.replace(memberPath);
        }
      } catch {
        // 비회원 공개 사이트 유지
      }
    })();
  }, [location]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <HomeShopPage />}</Route>
      <Route path="/shop">{() => <HomeShopPage startAtShop />}</Route>
      <Route path="/shop/category/:categoryId" component={GoodsCategoryPage} />
      <Route path="/shop/product/:productId" component={GoodsDetailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function PublicApp() {
  useEffect(() => {
    const iconLink =
      document.querySelector<HTMLLinkElement>("link[rel='icon']") ??
      (() => {
        const link = document.createElement("link");
        link.rel = "icon";
        link.type = "image/png";
        document.head.appendChild(link);
        return link;
      })();

    const previousHref = iconLink.href;
    iconLink.href = userFavicon;

    return () => {
      iconLink.href = previousHref;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <UserAssetProvider>
        <SiteModeProvider mode="public">
          <MemberSessionRedirect />
          <div className="min-h-screen bg-[#111111]">
            <div className="max-w-lg mx-auto w-full min-h-screen shadow-2xl shadow-black/40">
              <Router />
            </div>
          </div>
          <Toaster />
        </SiteModeProvider>
      </UserAssetProvider>
    </QueryClientProvider>
  );
}
