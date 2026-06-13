import { createContext, useContext, ReactNode } from "react";
import { getAllAssets, AssetKey } from "@/lib/assetPreloader";

interface AssetContextType {
  assets: Record<AssetKey, string>;
  isLoading: boolean;
}

const AssetContext = createContext<AssetContextType>({
  assets: {} as Record<AssetKey, string>,
  isLoading: false,
});

export function AssetProvider({ children }: { children: ReactNode }) {
  // 정적 import로 변경되어 즉시 사용 가능
  const assets = getAllAssets();
  
  return (
    <AssetContext.Provider value={{ assets, isLoading: false }}>
      {children}
    </AssetContext.Provider>
  );
}

export function useAssets() {
  return useContext(AssetContext);
}
