/** Bloomberg-desk 차트 팔레트 (amber lead, no violet). */
export const CHART_COLORS = [
  "#f5a524",
  "#38bdf8",
  "#34d399",
  "#fb7185",
  "#a3e635",
  "#fbbf24",
  "#22d3ee",
  "#f472b6",
];

export function colorForIndex(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
