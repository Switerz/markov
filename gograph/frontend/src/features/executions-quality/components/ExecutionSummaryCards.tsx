import { MetricCard } from "../../../shared/ui";
import { lucideIcon } from "../icons";
import type { SummaryMetric } from "../types";
import styles from "./ExecutionSummaryCards.module.css";

export type ExecutionSummaryCardsProps = {
  metrics: SummaryMetric[];
};

// The `confidence` card needs to show its qualitative badge ("Alta") near the
// value. Smallest acceptable change: surface the badge via the `subtitle` slot
// of MetricCard so we keep the shared primitive untouched.
function deriveSubtitle(m: SummaryMetric): string | undefined {
  if (m.badge) return m.badge;
  return m.subtitle;
}

export function ExecutionSummaryCards({ metrics }: ExecutionSummaryCardsProps) {
  return (
    <div className={styles.grid}>
      {metrics.map((m) => (
        <MetricCard
          key={m.id}
          title={m.title}
          value={m.value}
          subtitle={deriveSubtitle(m)}
          delta={m.delta}
          icon={lucideIcon(m.icon, 18)}
          tone={m.tone}
        />
      ))}
    </div>
  );
}
