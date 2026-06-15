import { useMemo } from "react";
import {
  Cell,
  Customized,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { Tone } from "../tokens/tokens";
import { toneColor } from "./toneColor";
import styles from "./DonutRoleChart.module.css";

export type DonutSegment = {
  label: string;
  description?: string;
  value: number;
  tone: Tone;
};

export type DonutRoleChartProps = {
  segments: DonutSegment[];
  centerLabel?: string;
  height?: number;
};

type CustomizedSize = { width?: number; height?: number };

export function DonutRoleChart({
  segments,
  centerLabel,
  height = 280,
}: DonutRoleChartProps) {
  const total = useMemo(
    () => segments.reduce((acc, s) => acc + s.value, 0),
    [segments],
  );

  const data = useMemo(
    () =>
      segments.map((s) => ({
        name: s.label,
        value: s.value,
        tone: s.tone,
      })),
    [segments],
  );

  return (
    <div
      className={styles.root}
      style={{
        height,
        display: "grid",
        gridTemplateColumns: "1fr minmax(140px, 1fr)",
        gap: 16,
      }}
    >
      <div style={{ position: "relative", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="60%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="var(--gg-surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={`c-${i}`} fill={toneColor(d.tone)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--gg-surface)",
                border: "1px solid var(--gg-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {centerLabel && (
              <Customized
                component={(props: CustomizedSize) => {
                  const w = props.width ?? 0;
                  const h = props.height ?? 0;
                  return (
                    <text
                      x={w / 2}
                      y={h / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={styles.centerLabel}
                    >
                      {centerLabel}
                    </text>
                  );
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className={styles.legend} aria-label="Legenda">
        {segments.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <li key={s.label} className={styles.item}>
              <span
                className={styles.dot}
                style={{ background: toneColor(s.tone) }}
                aria-hidden
              />
              <span>
                <span className={styles.label}>{s.label}</span>
                {s.description && (
                  <span className={styles.description}>{s.description}</span>
                )}
              </span>
              <span className={styles.value}>{pct.toFixed(1)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
