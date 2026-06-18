import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "../../../shared/ui";
import type { LiftInsight } from "../types";
import styles from "./LiftInsightCard.module.css";

const CATEGORY_LABELS: Record<LiftInsight["category"], string> = {
  canal: "Canal",
  sequencia: "Sequência",
  conteudo: "Conteúdo",
  pagina: "Página",
  evento: "Evento",
};

const CONFIDENCE_LABELS: Record<LiftInsight["confidence"], string> = {
  baixa: "Confiança Baixa",
  media: "Confiança Média",
  alta: "Confiança Alta",
};

const confidenceTone: Record<LiftInsight["confidence"], "red" | "orange" | "green"> = {
  baixa: "red",
  media: "orange",
  alta: "green",
};

const PRIORITY_COLOR: Record<LiftInsight["priority"], string> = {
  baixa: "var(--gg-border)",
  media: "var(--gg-blue)",
  alta: "var(--gg-orange)",
  critica: "var(--gg-red)",
};

type Props = { insight: LiftInsight };

export function LiftInsightCard({ insight }: Props) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const liftPositive = insight.liftPct > 0;

  return (
    <article
      className={styles.card}
      style={{ "--priority-color": PRIORITY_COLOR[insight.priority] } as React.CSSProperties}
    >
      <div className={styles.header}>
        <div className={styles.badges}>
          <Badge tone="neutral" variant="soft" size="sm">{CATEGORY_LABELS[insight.category]}</Badge>
        </div>
        <Badge tone={confidenceTone[insight.confidence]} variant="soft" size="sm">
          {CONFIDENCE_LABELS[insight.confidence]}
        </Badge>
      </div>

      <h3 className={styles.title}>{insight.title}</h3>

      <div className={styles.liftChip}>
        <span className={`${styles.liftValue} ${liftPositive ? styles.liftPositive : styles.liftNegative}`}>
          {liftPositive ? "+" : ""}{insight.liftPct}%
        </span>
        <span className={styles.liftLabel}>lift estimado</span>
      </div>

      {insight.baseLabel && insight.liftLabel && (
        <div className={styles.pathComparison}>
          <div className={styles.pathRow}>
            <span className={styles.pathTag}>Sem</span>
            <span className={styles.pathName}>{insight.baseLabel}</span>
            {insight.baseConvRate != null && (
              <span className={styles.pathRate}>{(insight.baseConvRate * 100).toFixed(1)}%</span>
            )}
          </div>
          <div className={styles.pathDivider}>
            <span className={styles.pathDelta}>
              {liftPositive ? "+" : ""}{insight.liftPct}%
            </span>
            <ChevronRight size={13} className={styles.pathArrow} />
          </div>
          <div className={`${styles.pathRow} ${styles.pathRowLift}`}>
            <span className={`${styles.pathTag} ${styles.pathTagLift}`}>Com</span>
            <span className={`${styles.pathName} ${styles.pathNameLift}`}>{insight.liftLabel}</span>
            {insight.liftConvRate != null && (
              <span className={`${styles.pathRate} ${styles.pathRateLift}`}>
                {(insight.liftConvRate * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Evidência</span>
        <ul className={styles.evidenceList}>
          {insight.evidence.map((ev, i) => (
            <li key={i} className={styles.evidenceItem}>{ev}</li>
          ))}
        </ul>
      </div>

      <p className={styles.hypothesis}>{insight.hypothesis}</p>

      <button
        className={styles.actionsToggle}
        onClick={() => setActionsOpen((o) => !o)}
        aria-expanded={actionsOpen}
      >
        <span>Ações recomendadas</span>
        <ChevronDown
          size={13}
          className={`${styles.toggleIcon} ${actionsOpen ? styles.toggleIconOpen : ""}`}
        />
      </button>

      {actionsOpen && (
        <ul className={styles.actionList}>
          {insight.actions.map((action, i) => (
            <li key={i} className={styles.actionItem}>
              <ChevronRight size={12} className={styles.actionIcon} />
              {action}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
