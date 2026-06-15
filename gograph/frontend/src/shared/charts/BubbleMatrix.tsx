import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { Tone } from "../tokens/tokens";
import styles from "./BubbleMatrix.module.css";

const toneColor = (tone: Tone): string => `var(--gg-${tone})`;

export type BubblePoint = {
  id: string;
  x: number;
  y: number;
  size: number;
  tone: Tone;
  label: string;
};

export type Quadrant = {
  label: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  description?: string;
};

export type BubbleMatrixProps = {
  points: BubblePoint[];
  axes: { x: string; y: string };
  quadrants?: Quadrant[];
  xScale?: "linear" | "log";
  yScale?: "linear" | "log";
  xDomain?: [number, number];
  yDomain?: [number, number];
  onPointClick?: (id: string) => void;
  height?: number;
  legendSizes?: number[];
  formatLegendSize?: (v: number) => string;
};

const PAD_LEFT = 56;
const PAD_RIGHT = 24;
const PAD_TOP = 24;
const PAD_BOTTOM = 48;
const LOG_EPS = 1e-3;
const MIN_RADIUS = 6;
const MAX_RADIUS = 28;

const defaultFormatLegendSize = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${v}`;
};

const safeLog = (v: number): number => Math.log10(Math.max(v, LOG_EPS));

const scaleValue = (
  v: number,
  min: number,
  max: number,
  range: number,
  type: "linear" | "log",
): number => {
  if (max === min) return range / 2;
  if (type === "log") {
    const lmin = safeLog(min);
    const lmax = safeLog(max);
    if (lmax === lmin) return range / 2;
    return ((safeLog(v) - lmin) / (lmax - lmin)) * range;
  }
  return ((v - min) / (max - min)) * range;
};

const niceTicks = (
  min: number,
  max: number,
  type: "linear" | "log",
  count = 5,
): number[] => {
  if (count <= 1) return [min];
  if (type === "log") {
    const lmin = safeLog(min);
    const lmax = safeLog(max);
    const step = (lmax - lmin) / (count - 1);
    return Array.from({ length: count }, (_, i) => Math.pow(10, lmin + step * i));
  }
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
};

const formatTick = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  if (abs < 1 && abs > 0) return v.toFixed(2);
  if (Number.isInteger(v)) return `${v}`;
  return v.toFixed(1);
};

export function BubbleMatrix({
  points,
  axes,
  quadrants,
  xScale = "linear",
  yScale = "linear",
  xDomain,
  yDomain,
  onPointClick,
  height = 360,
  legendSizes,
  formatLegendSize = defaultFormatLegendSize,
}: BubbleMatrixProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || 600);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { xMin, xMax, yMin, yMax, sMin, sMax } = useMemo(() => {
    if (points.length === 0) {
      return { xMin: 0, xMax: 1, yMin: 0, yMax: 1, sMin: 0, sMax: 1 };
    }
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const ss = points.map((p) => p.size);
    return {
      xMin: xDomain ? xDomain[0] : Math.min(...xs),
      xMax: xDomain ? xDomain[1] : Math.max(...xs),
      yMin: yDomain ? yDomain[0] : Math.min(...ys),
      yMax: yDomain ? yDomain[1] : Math.max(...ys),
      sMin: Math.min(...ss),
      sMax: Math.max(...ss),
    };
  }, [points, xDomain, yDomain]);

  const innerWidth = Math.max(width - PAD_LEFT - PAD_RIGHT, 1);
  const innerHeight = Math.max(height - PAD_TOP - PAD_BOTTOM, 1);

  const xScreen = useCallback(
    (v: number) => PAD_LEFT + scaleValue(v, xMin, xMax, innerWidth, xScale),
    [xMin, xMax, innerWidth, xScale],
  );
  const yScreen = useCallback(
    (v: number) =>
      PAD_TOP + innerHeight - scaleValue(v, yMin, yMax, innerHeight, yScale),
    [yMin, yMax, innerHeight, yScale],
  );

  const radius = useCallback(
    (s: number) => {
      if (sMax === sMin) return (MIN_RADIUS + MAX_RADIUS) / 2;
      const t = (Math.sqrt(Math.max(s, 0)) - Math.sqrt(Math.max(sMin, 0))) /
        (Math.sqrt(sMax) - Math.sqrt(Math.max(sMin, 0)));
      return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
    },
    [sMin, sMax],
  );

  const xTicks = useMemo(
    () => niceTicks(xMin, xMax, xScale, 5),
    [xMin, xMax, xScale],
  );
  const yTicks = useMemo(
    () => niceTicks(yMin, yMax, yScale, 5),
    [yMin, yMax, yScale],
  );

  const midX = PAD_LEFT + innerWidth / 2;
  const midY = PAD_TOP + innerHeight / 2;

  const handleKeyDown = (e: KeyboardEvent<SVGGElement>, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPointClick?.(id);
    }
  };

  const quadRect = (pos: Quadrant["position"]) => {
    const w = innerWidth / 2;
    const h = innerHeight / 2;
    const map: Record<Quadrant["position"], { x: number; y: number }> = {
      "top-left": { x: PAD_LEFT, y: PAD_TOP },
      "top-right": { x: PAD_LEFT + w, y: PAD_TOP },
      "bottom-left": { x: PAD_LEFT, y: PAD_TOP + h },
      "bottom-right": { x: PAD_LEFT + w, y: PAD_TOP + h },
    };
    const isAlt = pos === "top-left" || pos === "bottom-right";
    return { ...map[pos], w, h, fill: isAlt ? "var(--gg-surface-soft)" : "var(--gg-surface)" };
  };

  const quadLabelPos = (pos: Quadrant["position"]) => {
    const inset = 12;
    const map: Record<
      Quadrant["position"],
      { x: number; y: number; anchor: "start" | "end"; baseline: "hanging" | "auto" }
    > = {
      "top-left": {
        x: PAD_LEFT + inset,
        y: PAD_TOP + inset,
        anchor: "start",
        baseline: "hanging",
      },
      "top-right": {
        x: PAD_LEFT + innerWidth - inset,
        y: PAD_TOP + inset,
        anchor: "end",
        baseline: "hanging",
      },
      "bottom-left": {
        x: PAD_LEFT + inset,
        y: PAD_TOP + innerHeight - inset - 14,
        anchor: "start",
        baseline: "auto",
      },
      "bottom-right": {
        x: PAD_LEFT + innerWidth - inset,
        y: PAD_TOP + innerHeight - inset - 14,
        anchor: "end",
        baseline: "auto",
      },
    };
    return map[pos];
  };

  return (
    <div ref={containerRef} className={styles.root} style={{ height }}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${axes.y} por ${axes.x}`}
      >
        {/* Quadrant backgrounds */}
        {quadrants?.map((q) => {
          const r = quadRect(q.position);
          return (
            <rect
              key={`bg-${q.position}`}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              fill={r.fill}
              stroke="var(--gg-border)"
              strokeDasharray="2 4"
            />
          );
        })}

        {/* Mid axis cross */}
        <line
          className={styles.gridLine}
          x1={midX}
          y1={PAD_TOP}
          x2={midX}
          y2={PAD_TOP + innerHeight}
          strokeDasharray="3 3"
        />
        <line
          className={styles.gridLine}
          x1={PAD_LEFT}
          y1={midY}
          x2={PAD_LEFT + innerWidth}
          y2={midY}
          strokeDasharray="3 3"
        />

        {/* Axis frame */}
        <line
          className={styles.gridLine}
          x1={PAD_LEFT}
          y1={PAD_TOP + innerHeight}
          x2={PAD_LEFT + innerWidth}
          y2={PAD_TOP + innerHeight}
        />
        <line
          className={styles.gridLine}
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT}
          y2={PAD_TOP + innerHeight}
        />

        {/* X ticks */}
        {xTicks.map((t, i) => {
          const x = xScreen(t);
          return (
            <g key={`xt-${i}`}>
              <line
                className={styles.gridLine}
                x1={x}
                y1={PAD_TOP + innerHeight}
                x2={x}
                y2={PAD_TOP + innerHeight + 4}
              />
              <text
                className={styles.axisTick}
                x={x}
                y={PAD_TOP + innerHeight + 16}
                textAnchor="middle"
              >
                {formatTick(t)}
              </text>
            </g>
          );
        })}

        {/* Y ticks */}
        {yTicks.map((t, i) => {
          const y = yScreen(t);
          return (
            <g key={`yt-${i}`}>
              <line
                className={styles.gridLine}
                x1={PAD_LEFT - 4}
                y1={y}
                x2={PAD_LEFT}
                y2={y}
              />
              <text
                className={styles.axisTick}
                x={PAD_LEFT - 8}
                y={y + 3}
                textAnchor="end"
              >
                {formatTick(t)}
              </text>
            </g>
          );
        })}

        {/* Axis titles */}
        <text
          className={styles.axisTitle}
          x={PAD_LEFT + innerWidth / 2}
          y={height - 8}
          textAnchor="middle"
        >
          {axes.x}
        </text>
        <text
          className={styles.axisTitle}
          x={14}
          y={PAD_TOP + innerHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90, 14, ${PAD_TOP + innerHeight / 2})`}
        >
          {axes.y}
        </text>

        {/* Quadrant labels */}
        {quadrants?.map((q) => {
          const p = quadLabelPos(q.position);
          return (
            <g key={`lbl-${q.position}`}>
              <text
                className={styles.quadrantLabel}
                x={p.x}
                y={p.y}
                textAnchor={p.anchor}
                dominantBaseline={p.baseline}
              >
                {q.label}
              </text>
              {q.description && (
                <text
                  className={styles.quadrantDescription}
                  x={p.x}
                  y={p.y + 14}
                  textAnchor={p.anchor}
                  dominantBaseline={p.baseline}
                >
                  {q.description}
                </text>
              )}
            </g>
          );
        })}

        {/* Bubbles */}
        {points.map((pt) => {
          const cx = xScreen(pt.x);
          const cy = yScreen(pt.y);
          const r = radius(pt.size);
          const color = toneColor(pt.tone);
          const interactive = Boolean(onPointClick);
          return (
            <g
              key={pt.id}
              className={styles.bubble}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? () => onPointClick?.(pt.id) : undefined}
              onKeyDown={interactive ? (e) => handleKeyDown(e, pt.id) : undefined}
              aria-label={pt.label}
              data-testid={`bubble-${pt.id}`}
            >
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={color}
                fillOpacity={0.65}
                stroke={color}
                strokeOpacity={1}
                strokeWidth={1.5}
              />
              <text
                className={styles.label}
                x={cx}
                y={cy + r + 12}
                textAnchor="middle"
              >
                {pt.label}
              </text>
              <title>{`${pt.label}\n${axes.x}: ${formatTick(pt.x)}\n${axes.y}: ${formatTick(pt.y)}\nSize: ${formatLegendSize(pt.size)}`}</title>
            </g>
          );
        })}

        {/* Size legend */}
        {legendSizes && legendSizes.length > 0 && (() => {
          const legendY = PAD_TOP + innerHeight - 8;
          const spacing = 56;
          const totalW = legendSizes.length * spacing;
          const startX = PAD_LEFT + innerWidth - totalW + spacing / 2;
          return (
            <g>
              {legendSizes.map((s, i) => {
                const r = radius(s);
                const cx = startX + i * spacing;
                return (
                  <g key={`ls-${i}`}>
                    <circle
                      cx={cx}
                      cy={legendY - MAX_RADIUS - 4}
                      r={r}
                      fill="none"
                      stroke="var(--gg-text-secondary)"
                      strokeWidth={1}
                    />
                    <text
                      className={styles.legend}
                      x={cx}
                      y={legendY}
                      textAnchor="middle"
                    >
                      {formatLegendSize(s)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
