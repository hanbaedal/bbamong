import { createContext, useContext, type ReactNode } from "react";
import { getShopRoutes, type ShopRoutes, type SiteMode } from "@/lib/shopRoutes";

const SiteModeContext = createContext<SiteMode>("user");

export function SiteModeProvider({
  mode,
  children,
}: {
  mode: SiteMode;
  children: ReactNode;
}) {
  return (
    <SiteModeContext.Provider value={mode}>{children}</SiteModeContext.Provider>
  );
}

export function useSiteMode(): SiteMode {
  return useContext(SiteModeContext);
}

export function useShopRoutes(): ShopRoutes {
  return getShopRoutes(useSiteMode());
}
