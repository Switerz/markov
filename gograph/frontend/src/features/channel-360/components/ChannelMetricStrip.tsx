import { MetricCard } from "../../../shared/ui";
import { lucideIcon } from "../icons";
import type { ChannelMetric } from "../types";
import styles from "./ChannelMetricStrip.module.css";

export type ChannelMetricStripProps = {
  metrics: ChannelMetric[];
};

export function ChannelMetricStrip({ metrics }: ChannelMetricStripProps) {
  return (
    <div className={styles.strip}>
      {metrics.map((m) => (
        <MetricCard
          key={m.id}
          title={m.title}
          value={m.value}
          icon={lucideIcon(m.icon, 16)}
          tone={m.tone}
          delta={m.delta}
        />
      ))}
    </div>
  );
}
