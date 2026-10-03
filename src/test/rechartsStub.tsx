import type { ReactNode } from "react";

/**
 * recharts 대체물. 차트가 받는 데이터(data)와 시리즈 설정(name/fill/stroke)을 data-* 속성으로 노출해
 * 화면 로직이 계산한 차트 입력값을 테스트·스냅샷으로 고정할 수 있게 한다.
 */
type P = { children?: ReactNode; data?: unknown; [k: string]: unknown };

const chart = (kind: string) =>
  function Chart({ children, data, layout }: P) {
    return (
      <div data-chart={kind} data-layout={layout as string | undefined} data-chart-data={JSON.stringify(data ?? null)}>
        {children}
      </div>
    );
  };

const series = (kind: string) =>
  function Series({ name, fill, stroke, dataKey, stackId }: P) {
    return (
      <div
        data-series={kind}
        data-name={name as string | undefined}
        data-fill={fill as string | undefined}
        data-stroke={stroke as string | undefined}
        data-key={typeof dataKey === "string" ? dataKey : undefined}
        data-stack={stackId as string | undefined}
      />
    );
  };

const Passthrough = ({ children }: P) => <div data-chart-container>{children}</div>;
const Nothing = () => null;

export const ResponsiveContainer = Passthrough;
export const BarChart = chart("BarChart");
export const LineChart = chart("LineChart");
export const PieChart = chart("PieChart");
export const Bar = series("Bar");
export const Line = series("Line");
export const Pie = ({ data, children }: P) => (
  <div data-series="Pie" data-pie-data={JSON.stringify(data ?? null)}>
    {children}
  </div>
);
export const Cell = ({ fill }: P) => <div data-cell data-fill={fill as string | undefined} />;
export const XAxis = Nothing;
export const YAxis = Nothing;
export const CartesianGrid = Nothing;
export const Tooltip = Nothing;
export const Legend = Nothing;
