import { useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient, getFullUrl } from "@/lib/queryClient";
import { fetchMallCategories, MALL_CATEGORIES_QUERY_KEY } from "@/lib/mallQueries";
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
import userFavicon from "@assets/user/user-mascot-favicon.png";
import MallImagePreconnect from "@/components/mall/MallImagePreconnect";
import MallOrientationManager from "@/components/mall/MallOrientationManager";

function MallShell({ children }: { children: React.ReactNode }) {
  const { data, isLoading: categoriesLoading } = useQuery({
    queryKey: MALL_CATEGORIES_QUERY_KEY,
    queryFn: fetchMallCategories,
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
        categoriesLoading={categoriesLoading}
        mallTitle={settingsData?.goodsSectionTitle}
      />
      <main>{children}</main>
      <footer className="border-t border-neutral-200 mt-12 py-8 text-center text-xs text-neutral-400">
        빠몽이 쇼핑센터 · 주문은 게임 앱 정회원 전용
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
    void queryClient.prefetchQuery({
      queryKey: MALL_CATEGORIES_QUERY_KEY,
      queryFn: fetchMallCategories,
      staleTime: 120_000,
    });
  }, []);

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
