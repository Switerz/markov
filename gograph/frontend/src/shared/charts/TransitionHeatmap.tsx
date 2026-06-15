import { useMemo } from "react";
import { cn } from "../ui/cn";
import styles from "./TransitionHeatmap.module.css";

export type HeatmapRow = { from: string; values: (number | null)[] };

export type TransitionHeatmapProps = {
  columns: string[];
  rows: HeatmapRow[];
  metricLabel?: string;
  formatCell?: (v: number) => string;
};

const defaultFormat = (v: number): string => `${(v * 100).toFixed(1)}%`;

// Blue: #245BFF -> rgb(36, 91, 255)
const BLUE_RGB = { r: 36, g: 91, b: 255 };

const interpolateBg = (ratio: number): string => {
  // 0 -> surface-soft (use 0 opacity overlay), 1 -> full blue
  const alpha = Math.max(0, Math.min(1, ratio));
  return `rgba(${BLUE_RGB.r}, ${BLUE_RGB.g}, ${BLUE_RGB.b}, ${alpha.toFixed(3)})`;
};

// Choose text color based on perceived luminance of the cell background.
const textColorFor = (ratio: number): string => {
  // We render the blue overlay on a white-ish background.
  // Luminance approximation of the resulting color.
  const r = 255 * (1 - ratio) + BLUE_RGB.r * ratio;
  const g = 255 * (1 - ratio) + BLUE_RGB.g * ratio;
  const b = 255 * (1 - ratio) + BLUE_RGB.b * ratio;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "var(--gg-text-primary)" : "#fff";
};

export function TransitionHeatmap({
  columns,
  rows,
  metricLabel,
  formatCell = defaultFormat,
}: TransitionHeatmapProps) {
  const maxValue = useMemo(() => {
    let m = 0;
    rows.forEach((r) =>
      r.values.forEach((v) => {
        if (v !== null && v > m) m = v;
      }),
    );
    return m === 0 ? 1 : m;
  }, [rows]);

  return (
    <div className={styles.root}>
      {metricLabel && <div className={styles.metricLabel}>{metricLabel}</div>}
      <table className={styles.table}>
        <thead>
          <tr className={styles.headRow}>
            <th className={cn(styles.firstCol, styles.corner)} scope="col">
              {" "}
            </th>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.from}>
              <th className={styles.firstCol} scope="row">
                {row.from}
              </th>
              {row.values.map((v, i) => {
                if (v === null) {
                  return (
                    <td
                      key={`${row.from}-${i}`}
                      className={cn(styles.cell, styles.diag)}
                      aria-label="self-loop"
                    >
                      ·
                    </td>
                  );
                }
                const ratio = v / maxValue;
                return (
                  <td
                    key={`${row.from}-${i}`}
                    className={styles.cell}
                    style={{
                      background: interpolateBg(ratio),
                      color: textColorFor(ratio),
                    }}
                  >
                    {formatCell(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
