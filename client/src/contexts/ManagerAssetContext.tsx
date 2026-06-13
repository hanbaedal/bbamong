import { createContext, useContext, ReactNode } from "react";
import { getAllManagerAssets, ManagerAssetKey } from "@/lib/managerAssetPreloader";

interface ManagerAssetContextType {
  assets: Record<ManagerAssetKey, string>;
  isLoading: boolean;
}

const ManagerAssetContext = createContext<ManagerAssetContextType>({
  assets: {} as Record<ManagerAssetKey, string>,
  isLoading: false,
});

export function ManagerAssetProvider({ children }: { children: ReactNode }) {
  // 정적 import로 변경되어 즉시 사용 가능
  const assets = getAllManagerAssets();
  
  return (
    <ManagerAssetContext.Provider value={{ assets, isLoading: false }}>
      {children}
    </ManagerAssetContext.Provider>
  );
}

export function useManagerAssets() {
  return useContext(ManagerAssetContext);
}
