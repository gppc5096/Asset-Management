/** 파이/막대 차트 시리즈에서 공통으로 사용하는 색상 팔레트. */
export const CHART_COLORS = [
  "#7c3aed",
  "#f97316",
  "#0ea5e9",
  "#22c55e",
  "#ef4444",
  "#eab308",
  "#ec4899",
  "#14b8a6",
];

export function colorForIndex(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
