export const WITHHOLDING_TAX_RATE = 0.154;

/**
 * 일반계좌/특별계좌만 원천징수 대상. 비과세계좌는 항상 0원 (실데이터 26건 전수 확인).
 */
export function calcTaxAmount(
  taxedDistribution: number,
  category: "general" | "special" | "tax-free"
): number {
  if (category === "tax-free") return 0;
  return Math.round(taxedDistribution * WITHHOLDING_TAX_RATE);
}

export function calcNetTotal(distributionReceived: number, taxAmount: number): number {
  return distributionReceived - taxAmount;
}

export type DistributionInput = {
  quantity: number;
  distribution: number; // 주당 분배금
  taxBase: number; // 주당 과세대상 분배금
};

/**
 * 실데이터 51건 전수 검증된 파생 공식:
 * distributionReceived = distribution × quantity
 * taxedDistribution = taxBase × quantity
 * taxAmount = round(taxedDistribution × 0.154) (일반/특별), 비과세는 0
 * total = distributionReceived − taxAmount
 */
export function computeDistributionAmounts(
  input: DistributionInput,
  category: "general" | "special" | "tax-free"
) {
  const distributionReceived = input.distribution * input.quantity;
  const taxedDistribution = input.taxBase * input.quantity;
  const taxAmount = calcTaxAmount(taxedDistribution, category);
  const total = calcNetTotal(distributionReceived, taxAmount);
  return { distributionReceived, taxedDistribution, taxAmount, total };
}
