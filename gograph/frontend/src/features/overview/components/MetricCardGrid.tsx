import { MetricCard } from "../../../shared/ui";
import { lucideIcon } from "../icons";
import type { MetricItem } from "../types";
import styles from "./MetricCardGrid.module.css";

export type MetricCardGridProps = { metrics: MetricItem[] };

export function MetricCardGrid({ metrics }: MetricCardGridProps) {
  return (
    <div className={styles.grid}>
      {metrics.map((m) => (
        <MetricCard
          key={m.id}
          title={m.title}
          value={m.value}
          subtitle={m.subtitle}
          delta={m.delta}
          icon={lucideIcon(m.icon, 18)}
          tone={m.tone}
        />
      ))}
    </div>
  );
}
