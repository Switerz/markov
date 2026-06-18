import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PriorityDecisions, PriorityRecommendation } from "../types";
import { DecisionCard } from "./DecisionCard";
import styles from "./PriorityDecisionCarousel.module.css";

export type PriorityDecisionCarouselProps = {
  decisions: PriorityDecisions;
  onViewChannel?: (channel: string) => void;
  onCreateScenario?: (channel: string) => void;
};

type FilterValue = "all" | PriorityRecommendation;

const FILTER_OPTIONS: Array<{ id: FilterValue; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "Escalar", label: "Escalar" },
  { id: "Defender", label: "Defender" },
  { id: "Investigar", label: "Investigar" },
  { id: "Reduzir", label: "Reduzir" },
];

export function PriorityDecisionCarousel({
  decisions,
  onViewChannel,
  onCreateScenario,
}: PriorityDecisionCarouselProps) {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [scrollRef, setScrollRef] = useState<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return decisions.cards;
    return decisions.cards.filter((c) => c.recommendation === filter);
  }, [decisions.cards, filter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: decisions.cards.length };
    for (const card of decisions.cards) {
      map[card.recommendation] = (map[card.recommendation] ?? 0) + 1;
    }
    return map;
  }, [decisions.cards]);

  function scrollBy(direction: 1 | -1) {
    if (!scrollRef) return;
    scrollRef.scrollBy({ left: direction * scrollRef.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section className={styles.root} aria-label={decisions.title}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>{decisions.title}</h2>
          <p className={styles.subtitle}>{decisions.subtitle}</p>
        </div>
        <div className={styles.headerControls}>
          <div className={styles.filterTabs} role="tablist">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={filter === opt.id}
                className={`${styles.tab} ${filter === opt.id ? styles.tabActive : ""}`}
                onClick={() => setFilter(opt.id)}
              >
                {opt.label}
                <span className={styles.tabCount}>{counts[opt.id] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className={styles.scrollControls}>
            <button
              type="button"
              className={styles.scrollBtn}
              onClick={() => scrollBy(-1)}
              aria-label="Rolar para a esquerda"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className={styles.scrollBtn}
              onClick={() => scrollBy(1)}
              aria-label="Rolar para a direita"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className={styles.viewport}>
        <div className={styles.row} ref={setScrollRef}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>Nenhum canal com essa recomendação.</div>
          ) : (
            filtered.map((card) => (
              <div key={card.channel} className={styles.cardWrapper}>
                <DecisionCard
                  decision={card}
                  onViewChannel={onViewChannel}
                  onCreateScenario={onCreateScenario}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
