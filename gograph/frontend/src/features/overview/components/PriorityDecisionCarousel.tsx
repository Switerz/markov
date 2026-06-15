import { Select } from "../../../shared/ui";
import type { PriorityDecisions } from "../types";
import { DecisionCard } from "./DecisionCard";
import styles from "./PriorityDecisionCarousel.module.css";

export type PriorityDecisionCarouselProps = { decisions: PriorityDecisions };

export function PriorityDecisionCarousel({
  decisions,
}: PriorityDecisionCarouselProps) {
  return (
    <section className={styles.root} aria-label={decisions.title}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>{decisions.title}</h2>
          <p className={styles.subtitle}>{decisions.subtitle}</p>
        </div>
        <div className={styles.sortGroup}>
          <span className={styles.sortLabel}>Ordenar:</span>
          <Select value={decisions.sort} ariaLabel="Ordenar decisões">
            <Select.Item value={decisions.sort}>{decisions.sort}</Select.Item>
          </Select>
        </div>
      </div>
      <div className={styles.row}>
        {decisions.cards.map((card) => (
          <DecisionCard key={card.channel} decision={card} />
        ))}
      </div>
    </section>
  );
}
