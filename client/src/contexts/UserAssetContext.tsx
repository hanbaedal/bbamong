import { createContext, useContext, ReactNode } from "react";
import { getAllUserAssets, UserAssetKey } from "@/lib/userAssetPreloader";

interface UserAssetContextType {
  assets: Record<UserAssetKey, string>;
  isLoading: boolean;
}

const UserAssetContext = createContext<UserAssetContextType>({
  assets: {} as Record<UserAssetKey, string>,
  isLoading: false,
});

export function UserAssetProvider({ children }: { children: ReactNode }) {
  // 정적 import로 변경되어 즉시 사용 가능
  const assets = getAllUserAssets();
  
  return (
    <UserAssetContext.Provider value={{ assets, isLoading: false }}>
      {children}
    </UserAssetContext.Provider>
  );
}

export function useUserAssets() {
  return useContext(UserAssetContext);
}
