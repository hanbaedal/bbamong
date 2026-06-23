import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { UserAssetProvider } from "@/contexts/UserAssetContext";
import { SiteModeProvider } from "@/contexts/SiteModeContext";
import HomeShopPage from "@/pages/home/shop";
import GoodsCategoryPage from "@/pages/home/goods-category";
import GoodsDetailPage from "@/pages/home/goods-detail";
import NotFound from "@/pages/not-found";
import userFavicon from "@assets/user/user-mascot-favicon.png";

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
