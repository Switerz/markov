import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Tone } from "../tokens/tokens";
import styles from "./BarLineTrendChart.module.css";

export type TrendBar = { key: string; value: number; tone: Tone; label?: string };

export type TrendDatum = {
  period: string;
  bars: TrendBar[];
  line?: { value: number; label?: string };
};

export type BarLineTrendChartProps = {
  data: TrendDatum[];
  barsAxisLabel?: string;
  lineAxisLabel?: string;
  height?: number;
};

const toneColor = (tone: Tone): string => `var(--gg-${tone})`;

type FlatRow = Record<string, number | string> & { period: string };

export function BarLineTrendChart({
  data,
  barsAxisLabel,
  lineAxisLabel,
  height = 320,
}: BarLineTrendChartProps) {
  const { rows, keys, toneByKey, labelByKey } = useMemo(() => {
    const toneMap = new Map<string, Tone>();
    const labelMap = new Map<string, string>();
    const flat: FlatRow[] = data.map((d) => {
      const row: FlatRow = { period: d.period };
      d.bars.forEach((b) => {
        row[b.key] = b.value;
        if (!toneMap.has(b.key)) toneMap.set(b.key, b.tone);
        if (b.label && !labelMap.has(b.key)) labelMap.set(b.key, b.label);
      });
      if (d.line) row["__line"] = d.line.value;
      return row;
    });
    const orderedKeys: string[] = [];
    data.forEach((d) => d.bars.forEach((b) => {
      if (!orderedKeys.includes(b.key)) orderedKeys.push(b.key);
    }));
    return {
      rows: flat,
      keys: orderedKeys,
      toneByKey: toneMap,
      labelByKey: labelMap,
    };
  }, [data]);

  const hasLine = data.some((d) => d.line !== undefined);

  return (
    <div className={styles.root} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 24, right: 24, left: 8, bottom: 16 }}
        >
          <CartesianGrid stroke="var(--gg-border)" vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fill: "var(--gg-text-secondary)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--gg-border)" }}
          />
          <YAxis
            yAxisId="bars"
            tick={{ fill: "var(--gg-text-secondary)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--gg-border)" }}
            label={
              barsAxisLabel
                ? {
                    value: barsAxisLabel,
                    angle: -90,
                    position: "insideLeft",
                    fill: "var(--gg-text-secondary)",
                    fontSize: 11,
                  }
                : undefined
            }
          />
          {hasLine && (
            <YAxis
              yAxisId="line"
              orientation="right"
              tick={{ fill: "var(--gg-text-secondary)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--gg-border)" }}
              label={
                lineAxisLabel
                  ? {
                      value: lineAxisLabel,
                      angle: 90,
                      position: "insideRight",
                      fill: "var(--gg-text-secondary)",
                      fontSize: 11,
                    }
                  : undefined
              }
            />
          )}
          <Tooltip
            cursor={{ fill: "var(--gg-surface-soft)" }}
            contentStyle={{
              background: "var(--gg-surface)",
              border: "1px solid var(--gg-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: "var(--gg-text-secondary)" }}
          />
          {keys.map((k) => (
            <Bar
              key={k}
              yAxisId="bars"
              dataKey={k}
              name={labelByKey.get(k) ?? k}
              fill={toneColor(toneByKey.get(k) ?? "neutral")}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          ))}
          {hasLine && (
            <Line
              yAxisId="line"
              type="monotone"
              dataKey="__line"
              name={data.find((d) => d.line?.label)?.line?.label ?? "Linha"}
              stroke="var(--gg-cyan)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: "var(--gg-cyan)" }}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
