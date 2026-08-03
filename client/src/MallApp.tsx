import { useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { UserProvider } from "@/contexts/UserContext";
import { UserAssetProvider } from "@/contexts/UserAssetContext";
import { MALL_BASE_PATH, isMallHost } from "@shared/mallConfig";
import MallHeader from "@/components/mall/MallHeader";
import MallHome from "@/pages/mall/MallHome";
import MallCategoryPage from "@/pages/mall/MallCategoryPage";
import MallProductPage from "@/pages/mall/MallProductPage";
import MallCartPage from "@/pages/mall/MallCartPage";
import MallCheckoutPage from "@/pages/mall/MallCheckoutPage";
import MallWishlistPage from "@/pages/mall/MallWishlistPage";
import NotFound from "@/pages/not-found";
import { useQuery } from "@tanstack/react-query";
import { getFullUrl } from "@/lib/queryClient";
import type { MallCategory } from "@/lib/mallTypes";
import userFavicon from "@assets/user/user-mascot-favicon.png";
import MallImagePreconnect from "@/components/mall/MallImagePreconnect";
import MallOrientationManager from "@/components/mall/MallOrientationManager";

function MallShell({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ["/api/mall/categories", "header"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/mall/categories"));
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ categories: MallCategory[] }>;
    },
    staleTime: 120_000,
  });

  const { data: settingsData } = useQuery({
    queryKey: ["/api/homepage-settings", "mall"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/homepage-settings"));
      if (!res.ok) return { goodsSectionTitle: undefined };
      return res.json() as Promise<{ goodsSectionTitle?: string }>;
    },
    staleTime: 120_000,
  });

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <MallHeader
        categories={data?.categories ?? []}
        mallTitle={settingsData?.goodsSectionTitle}
      />
      <main>{children}</main>
      <footer className="border-t border-neutral-200 mt-12 py-8 text-center text-xs text-neutral-400">
        빠몽이 기념품 · 주문은 게임 앱 정회원 전용
      </footer>
    </div>
  );
}

function Router() {
  const onMallSubdomain = isMallHost(window.location.hostname);

  return (
    <MallShell>
      <Switch>
        {onMallSubdomain ? (
          <Route path="/">{() => <Redirect to={MALL_BASE_PATH} />}</Route>
        ) : null}
        <Route path="/shop">{() => <MallHome />}</Route>
        <Route path="/shop/category/:categoryId" component={MallCategoryPage} />
        <Route path="/shop/product/:productId" component={MallProductPage} />
        <Route path="/shop/cart" component={MallCartPage} />
        <Route path="/shop/wishlist" component={MallWishlistPage} />
        <Route path="/shop/checkout" component={MallCheckoutPage} />
        <Route component={NotFound} />
      </Switch>
    </MallShell>
  );
}

export function isMallSitePath(path: string): boolean {
  const base = path.split("?")[0];
  if (base === MALL_BASE_PATH || base.startsWith(`${MALL_BASE_PATH}/`)) return true;
  return isMallHost(window.location.hostname);
}

export default function MallApp() {
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
    document.documentElement.classList.remove("native-app");
    document.documentElement.classList.add("mall-site");

    return () => {
      iconLink.href = previousHref;
      document.documentElement.classList.remove("mall-site");
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <UserAssetProvider>
        <UserProvider>
          <MallImagePreconnect />
          <MallOrientationManager />
          <Router />
          <Toaster />
        </UserProvider>
      </UserAssetProvider>
    </QueryClientProvider>
  );
}
