import { Card, Select } from "../../../shared/ui";
import { BubbleMatrix, type BubblePoint } from "../../../shared/charts";
import type { ConsensusModelId, ModelConsensus } from "../types";
import styles from "./ModelConsensusMatrix.module.css";

export type ModelConsensusMatrixProps = {
  consensus: ModelConsensus;
  onSelectX?: (model: ConsensusModelId) => void;
  onSelectY?: (model: ConsensusModelId) => void;
};

// Parses the JSON size buckets ("100K", "250K", "500K", "1M+") into numbers
// the BubbleMatrix can scale. Unknown formats fall back to 0.
function parseSizeBucket(raw: string): number {
  const m = raw.trim().match(/^([\d.]+)\s*([KMkm])\+?$/);
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2].toUpperCase();
  if (Number.isNaN(n)) return 0;
  if (unit === "M") return n * 1_000_000;
  if (unit === "K") return n * 1_000;
  return n;
}

function formatLegendSize(v: number): string {
  if (v >= 1_000_000) return `${v / 1_000_000}M+`;
  return `${v / 1_000}K`;
}

export function ModelConsensusMatrix({
  consensus,
  onSelectX,
  onSelectY,
}: ModelConsensusMatrixProps) {
  const points: BubblePoint[] = consensus.points.map((p) => ({
    id: p.channel,
    label: p.channel,
    x: p.x,
    y: p.y,
    tone: p.tone,
    size: parseSizeBucket(p.size),
  }));

  return (
    <Card>
      <Card.Header className={styles.head}>
        <div className={styles.titleBlock}>
          <Card.Title>{consensus.title}</Card.Title>
          <Card.Description>{consensus.subtitle}</Card.Description>
        </div>
        <div className={styles.viewByGroup}>
          <span className={styles.viewByLabel}>Eixo X:</span>
          <Select
            value={consensus.selectedX}
            onValueChange={(v) => onSelectX?.(v as ConsensusModelId)}
            ariaLabel="Modelo do eixo X"
          >
            {consensus.availableModels.map((m) => (
              <Select.Item key={m.id} value={m.id}>
                {m.label}
              </Select.Item>
            ))}
          </Select>
          <span className={styles.viewByLabel}>Eixo Y:</span>
          <Select
            value={consensus.selectedY}
            onValueChange={(v) => onSelectY?.(v as ConsensusModelId)}
            ariaLabel="Modelo do eixo Y"
          >
            {consensus.availableModels.map((m) => (
              <Select.Item key={m.id} value={m.id}>
                {m.label}
              </Select.Item>
            ))}
          </Select>
        </div>
      </Card.Header>
      <Card.Body className={styles.matrixWrapper}>
        <BubbleMatrix
          points={points}
          axes={consensus.axes}
          quadrants={consensus.quadrants}
          xDomain={[-100, 100]}
          yDomain={[-100, 100]}
          legendSizes={[100_000, 250_000, 500_000, 1_000_000]}
          formatLegendSize={formatLegendSize}
          height={380}
        />
      </Card.Body>
    </Card>
  );
}
