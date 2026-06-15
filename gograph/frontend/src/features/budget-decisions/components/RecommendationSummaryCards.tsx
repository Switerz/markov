import { MetricCard } from "../../../shared/ui";
import { lucideIcon } from "../icons";
import type { SummaryCard } from "../types";
import styles from "./RecommendationSummaryCards.module.css";

export type RecommendationSummaryCardsProps = {
  cards: SummaryCard[];
};

export function RecommendationSummaryCards({
  cards,
}: RecommendationSummaryCardsProps) {
  return (
    <div className={styles.grid}>
      {cards.map((c) => (
        <MetricCard
          key={c.id}
          title={c.title}
          value={c.value}
          subtitle={c.subtitle}
          icon={lucideIcon(c.icon, 18)}
          tone={c.tone}
        />
      ))}
    </div>
  );
}
