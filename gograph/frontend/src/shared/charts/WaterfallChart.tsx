import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./WaterfallChart.module.css";

export type WaterfallStepType = "start" | "positive" | "negative" | "bridge" | "end";

export type WaterfallStep = {
  label: string;
  value: number;
  display: string;
  type: WaterfallStepType;
};

export type WaterfallChartProps = {
  steps: WaterfallStep[];
  height?: number;
};

type Row = {
  label: string;
  display: string;
  type: WaterfallStepType;
  base: number;
  delta: number;
  range: [number, number];
  fill: string;
};

const colorFor = (type: WaterfallStepType): string => {
  switch (type) {
    case "positive":
      return "var(--gg-green)";
    case "negative":
      return "var(--gg-red)";
    case "start":
    case "end":
      return "var(--gg-neutral)";
    case "bridge":
    default:
      return "transparent";
  }
};

const computeRows = (steps: WaterfallStep[]): Row[] => {
  let running = 0;
  return steps.map((s) => {
    let base = 0;
    let top = 0;
    if (s.type === "start") {
      base = 0;
      top = s.value;
      running = s.value;
    } else if (s.type === "end") {
      base = 0;
      top = s.value;
    } else if (s.type === "positive") {
      base = running;
      top = running + s.value;
      running = top;
    } else if (s.type === "negative") {
      base = running + s.value; // s.value is negative
      top = running;
      running = running + s.value;
    } else {
      base = 0;
      top = 0;
    }
    const lo = Math.min(base, top);
    const hi = Math.max(base, top);
    return {
      label: s.label,
      display: s.display,
      type: s.type,
      base: lo,
      delta: hi - lo,
      range: [lo, hi],
      fill: colorFor(s.type),
    };
  });
};

export function WaterfallChart({ steps, height = 320 }: WaterfallChartProps) {
  const rows = useMemo(() => computeRows(steps), [steps]);

  return (
    <div className={styles.root} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 32, right: 16, left: 8, bottom: 24 }}
        >
          <CartesianGrid stroke="var(--gg-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--gg-text-secondary)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--gg-border)" }}
            angle={-20}
            textAnchor="end"
            height={50}
            interval={0}
          />
          <YAxis
            tick={{ fill: "var(--gg-text-secondary)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--gg-border)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--gg-surface-soft)" }}
            contentStyle={{
              background: "var(--gg-surface)",
              border: "1px solid var(--gg-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(_v, _name, item) => {
              const payload = (item as { payload?: Row } | undefined)?.payload;
              return payload?.display ?? "";
            }}
          />
          <Bar
            dataKey="base"
            stackId="wf"
            fill="transparent"
            isAnimationActive={false}
          />
          <Bar
            dataKey="delta"
            stackId="wf"
            isAnimationActive={false}
            radius={[3, 3, 0, 0]}
          >
            {rows.map((r, i) => (
              <Cell key={`wc-${i}`} fill={r.fill} />
            ))}
            <LabelList
              dataKey="display"
              position="top"
              fill="var(--gg-text-primary)"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
