import { Card, Select } from "../../../shared/ui";
import {
  BarLineTrendChart,
  type TrendDatum,
} from "../../../shared/charts";
import type { TimeEvolution } from "../types";
import styles from "./ChannelTrendChart.module.css";

export type ChannelTrendChartProps = {
  evolution: TimeEvolution;
};

// "4,3x" → 4.3. Tolerates "x" suffix and Brazilian decimal commas.
function parseRoas(s: string): number {
  const cleaned = s.replace(/x$/i, "").replace(",", ".").trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function ChannelTrendChart({ evolution }: ChannelTrendChartProps) {
  const data: TrendDatum[] = evolution.series.map((s) => ({
    period: s.month,
    bars: [
      { key: "markov", value: s.markov, tone: "blue", label: "Markov" },
      { key: "shapley", value: s.shapley, tone: "indigo", label: "Shapley" },
      {
        key: "lastClick",
        value: s.lastClick,
        tone: "neutral",
        label: "Último clique",
      },
    ],
    line: { value: parseRoas(s.roas), label: "ROAS" },
  }));

  return (
    <Card>
      <Card.Header>
        <Card.Title>{evolution.title}</Card.Title>
        <Card.Description>{evolution.subtitle}</Card.Description>
        <div className={styles.controls}>
          {evolution.controls.map((c) => (
            <div key={c.id} className={styles.controlGroup}>
              {c.label && (
                <span className={styles.controlLabel}>{c.label}</span>
              )}
              <Select value={c.value} ariaLabel={c.label ?? c.id}>
                <Select.Item value={c.value}>{c.value}</Select.Item>
              </Select>
            </div>
          ))}
        </div>
      </Card.Header>
      <Card.Body>
        <BarLineTrendChart
          data={data}
          barsAxisLabel="Receita atribuída (R$)"
          lineAxisLabel="ROAS"
        />
      </Card.Body>
    </Card>
  );
}
