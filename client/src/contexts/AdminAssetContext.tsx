import { createContext, useContext, ReactNode } from "react";
import { getAllAdminAssets, AdminAssetKey } from "@/lib/adminAssetPreloader";

interface AdminAssetContextType {
  assets: Record<AdminAssetKey, string>;
  isLoading: boolean;
}

const AdminAssetContext = createContext<AdminAssetContextType>({
  assets: {} as Record<AdminAssetKey, string>,
  isLoading: false,
});

export function AdminAssetProvider({ children }: { children: ReactNode }) {
  // 정적 import로 변경되어 즉시 사용 가능
  const assets = getAllAdminAssets();
  
  return (
    <AdminAssetContext.Provider value={{ assets, isLoading: false }}>
      {children}
    </AdminAssetContext.Provider>
  );
}

export function useAdminAssets() {
  return useContext(AdminAssetContext);
}
