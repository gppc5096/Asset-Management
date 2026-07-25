"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAssetConfig } from "@/hooks/useAssetConfig";

type AssetConfigContextValue = ReturnType<typeof useAssetConfig>;

const AssetConfigContext = createContext<AssetConfigContextValue | undefined>(
  undefined
);

/** users/{uid}/backups/asset-config에 대한 Firestore 리스너를 앱 전체에서 하나만 유지 */
export function AssetConfigProvider({ children }: { children: ReactNode }) {
  const value = useAssetConfig();
  return (
    <AssetConfigContext.Provider value={value}>
      {children}
    </AssetConfigContext.Provider>
  );
}

export function useAssetConfigContext() {
  const ctx = useContext(AssetConfigContext);
  if (!ctx) {
    throw new Error(
      "useAssetConfigContext must be used within AssetConfigProvider"
    );
  }
  return ctx;
}
