import type { AssetConfig, DistributionDoc } from "@/lib/types";

export function isAssetConfig(v: unknown): v is AssetConfig {
  if (!v || typeof v !== "object") return false;
  const c = v as Partial<AssetConfig>;
  return (
    Array.isArray(c.holdings) &&
    typeof c.cash?.krw === "number" &&
    typeof c.cash?.usd === "number" &&
    typeof c.exchangeRate?.rate === "number"
  );
}

export function isDistributionDoc(v: unknown): v is DistributionDoc {
  if (!v || typeof v !== "object") return false;
  const c = v as Partial<DistributionDoc>;
  return Array.isArray(c.records);
}
