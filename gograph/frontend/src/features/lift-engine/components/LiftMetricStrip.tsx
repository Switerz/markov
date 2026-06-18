import { TrendingUp, Zap, AlertTriangle, DollarSign } from "lucide-react";
import type { LiftMetricSummary } from "../types";
import styles from "./LiftMetricStrip.module.css";

type Props = { metrics: LiftMetricSummary };

export function LiftMetricStrip({ metrics }: Props) {
  return (
    <div className={styles.strip}>
      <Tile icon={<Zap size={18} />} label="Insights Identificados" value={String(metrics.totalInsights)} tone="blue" />
      <Tile icon={<TrendingUp size={18} />} label="Lift Médio Estimado" value={`+${metrics.avgLift}%`} tone="green" />
      <Tile icon={<AlertTriangle size={18} />} label="Oportunidades Críticas" value={String(metrics.criticalCount)} tone="orange" />
      <Tile icon={<DollarSign size={18} />} label="Impacto Est. em Receita" value={metrics.estimatedRevImpact} tone="indigo" />
    </div>
  );
}

type TileProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "blue" | "green" | "orange" | "indigo";
};

function Tile({ icon, label, value, tone }: TileProps) {
  return (
    <div className={`${styles.tile} ${styles[`tone_${tone}`]}`}>
      <span className={styles.tileIcon}>{icon}</span>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
    </div>
  );
}
