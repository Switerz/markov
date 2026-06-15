import { FlaskConical, Bookmark, AlertTriangle, type LucideIcon } from "lucide-react";
import { Card, Button } from "../../../shared/ui";
import type { ScenarioInsightsData } from "../types";
import styles from "./ScenarioInsightsPanel.module.css";

export type ScenarioInsightsPanelProps = {
  insights: ScenarioInsightsData;
  /** Triggered when the user clicks one of the footer action buttons. */
  onAction?: (label: string) => void;
};

const actionIcons: Record<string, LucideIcon> = {
  FlaskConical,
  Bookmark,
};

export function ScenarioInsightsPanel({
  insights,
  onAction,
}: ScenarioInsightsPanelProps) {
  return (
    <Card className={styles.root}>
      <Card.Header>
        <Card.Title>{insights.title}</Card.Title>
      </Card.Header>
      <Card.Body>
        <div className={styles.body}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Hipótese</h3>
            <p className={styles.hypothesis}>{insights.hypothesis}</p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Principais aprendizados</h3>
            <ul className={styles.list}>
              {insights.mainLearnings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className={styles.risk}>
            <header className={styles.riskHeader}>
              <AlertTriangle size={14} aria-hidden />
              <span>{insights.riskBox.title}</span>
            </header>
            <ul className={styles.list}>
              {insights.riskBox.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className={styles.nextTest}>
            <h3 className={styles.nextTestTitle}>
              {insights.nextRecommendedTest.title}
            </h3>
            <p className={styles.nextTestDescription}>
              {insights.nextRecommendedTest.description}
            </p>
            <div className={styles.chips}>
              <span className={styles.chip} data-tone="green">
                Receita: {insights.nextRecommendedTest.estimatedImpact.revenue}
              </span>
              <span className={styles.chip} data-tone="cyan">
                ROAS: {insights.nextRecommendedTest.estimatedImpact.roas}
              </span>
              <span className={styles.chip} data-tone="blue">
                Confiança: {insights.nextRecommendedTest.estimatedImpact.confidence}
              </span>
            </div>
          </section>
        </div>
      </Card.Body>
      <Card.Footer>
        <div className={styles.actions}>
          {insights.actions.map((action) => {
            const Icon = actionIcons[action.icon];
            return (
              <Button
                key={action.id}
                variant={action.variant}
                iconLeft={Icon ? <Icon size={14} /> : undefined}
                onClick={() => onAction?.(action.label)}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
      </Card.Footer>
    </Card>
  );
}
