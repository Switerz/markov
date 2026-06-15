import { Card } from "../../../shared/ui";
import { BubbleMatrix, type BubblePoint } from "../../../shared/charts";
import { formatCompactBRL } from "../../../shared/format";
import type { AllocationMatrixData } from "../types";
import styles from "./AllocationMatrix.module.css";

export type AllocationMatrixProps = {
  matrix: AllocationMatrixData;
  onPointClick?: (channel: string) => void;
};

// Parses contract strings like "R$ 24,82M" / "R$ 0,44K" / "R$ 2,11M" into
// a number in BRL units. Falls back to 0 if it can't be parsed.
const parseRevenue = (s: string): number => {
  const cleaned = s.replace(/R\$\s?/i, "").trim();
  const m = cleaned.match(/^([-\d.,]+)\s*([KMB])?$/i);
  if (!m) return 0;
  const num = Number(m[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(num)) return 0;
  const suffix = (m[2] ?? "").toUpperCase();
  const factor = suffix === "B" ? 1e9 : suffix === "M" ? 1e6 : suffix === "K" ? 1e3 : 1;
  return num * factor;
};

// X-axis uses log scale (contract goes 0% → 100%, so points sit at 0.2..60).
// Clamp the lower bound away from 0 so the log scale is defined for tiny shares.
const X_DOMAIN: [number, number] = [0.1, 100];
const Y_DOMAIN: [number, number] = [0, 100];

// Revenue bucket sizes used by the legend (R$ 0.5M, 2M, 5M, 25M).
const LEGEND_SIZES = [500_000, 2_000_000, 5_000_000, 25_000_000];

export function AllocationMatrix({ matrix, onPointClick }: AllocationMatrixProps) {
  const points: BubblePoint[] = matrix.points.map((p) => ({
    id: p.channel,
    x: Math.max(p.x, X_DOMAIN[0]),
    y: p.y,
    size: parseRevenue(p.revenue),
    tone: p.tone,
    label: p.channel,
  }));

  return (
    <Card className={styles.root}>
      <Card.Header>
        <Card.Title>{matrix.title}</Card.Title>
        <Card.Description>{matrix.subtitle}</Card.Description>
      </Card.Header>
      <Card.Body className={styles.body}>
        <BubbleMatrix
          points={points}
          axes={matrix.axes}
          quadrants={matrix.quadrants}
          xScale="log"
          xDomain={X_DOMAIN}
          yDomain={Y_DOMAIN}
          legendSizes={LEGEND_SIZES}
          formatLegendSize={formatCompactBRL}
          onPointClick={onPointClick}
          height={380}
        />
      </Card.Body>
      <Card.Footer>
        <p className={styles.helper}>{matrix.helper}</p>
      </Card.Footer>
    </Card>
  );
}
