import { Card } from "../../../shared/ui";
import type { JourneySummary } from "../types";
import { JourneyFlowStepper } from "./JourneyFlowStepper";
import styles from "./JourneySummaryPanel.module.css";

export type JourneySummaryPanelProps = { journey: JourneySummary };

export function JourneySummaryPanel({ journey }: JourneySummaryPanelProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{journey.title}</Card.Title>
      </Card.Header>
      <Card.Body>
        <div className={styles.columns}>
          {journey.columns.map((col) => (
            <div className={styles.column} key={col.title}>
              <h3 className={styles.columnTitle}>{col.title}</h3>
              <ul className={styles.list}>
                {col.items.map((it) => (
                  <li key={it.name} className={styles.item}>
                    <span className={styles.itemName}>{it.name}</span>
                    <span className={styles.itemValue}>{it.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className={styles.flow}>
          <JourneyFlowStepper steps={journey.flow} />
        </div>
        <div className={styles.footer}>
          <span>Tempo médio até conversão:</span>
          <span className={styles.footerValue}>
            {journey.averageTimeToConversion}
          </span>
        </div>
      </Card.Body>
    </Card>
  );
}
