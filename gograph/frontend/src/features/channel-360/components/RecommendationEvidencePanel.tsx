import { Card, Badge } from "../../../shared/ui";
import type { RecommendationEvidence } from "../types";
import styles from "./RecommendationEvidencePanel.module.css";

export type RecommendationEvidencePanelProps = {
  evidence: RecommendationEvidence;
};

export function RecommendationEvidencePanel({
  evidence,
}: RecommendationEvidencePanelProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{evidence.title}</Card.Title>
        <Badge tone="green" variant="soft">
          {evidence.badge}
        </Badge>
      </Card.Header>
      <Card.Body>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Por que aumentar o investimento
          </h3>
          <ul className={styles.list}>
            {evidence.whyIncreaseInvestment.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Riscos</h3>
          <ul className={styles.list}>
            {evidence.risks.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Boas práticas</h3>
          <ul className={styles.list}>
            {evidence.bestPractices.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      </Card.Body>
      <Card.Footer>
        <div className={styles.confidenceBox}>
          <p>{evidence.confidenceBox.title}</p>
          <button type="button" className={styles.confidenceLink}>
            {evidence.confidenceBox.link}
          </button>
        </div>
      </Card.Footer>
    </Card>
  );
}
