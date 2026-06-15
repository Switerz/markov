import { Card, ProgressBar } from "../../../shared/ui";
import type { Tone } from "../../../shared/tokens/tokens";
import type { AnalysisConfidence, ConfidenceItem } from "../types";
import styles from "./AnalysisConfidencePanel.module.css";

export type AnalysisConfidencePanelProps = { confidence: AnalysisConfidence };

// Parses values like "92%", "1,2h" into a 0..1 ratio.
// Non-percent values (e.g. "1,2h" for "Atraso médio") have no obvious
// percent mapping — we return null so the row shows the raw value as
// rightLabel without a progress bar fill.
function parsePercent(raw: string): number | null {
  const m = raw.trim().match(/^(-?[\d.,]+)\s*%$/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(1, n / 100));
}

function ConfidenceRow({ item, tone }: { item: ConfidenceItem; tone: Tone }) {
  const ratio = parsePercent(item.value);
  // When the value isn't a percent (e.g. "1,2h"), render a full track with
  // the raw value shown on the right so the data still appears.
  return (
    <ProgressBar
      value={ratio ?? 1}
      tone={tone}
      label={item.label}
      rightLabel={item.value}
    />
  );
}

export function AnalysisConfidencePanel({
  confidence,
}: AnalysisConfidencePanelProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{confidence.title}</Card.Title>
      </Card.Header>
      <Card.Body>
        <div className={styles.groups}>
          <div className={styles.group}>
            <h3 className={styles.groupTitle}>Calibração do modelo</h3>
            {confidence.modelCalibration.map((it) => (
              <ConfidenceRow key={it.label} item={it} tone="blue" />
            ))}
          </div>
          <div className={styles.group}>
            <h3 className={styles.groupTitle}>Qualidade dos dados</h3>
            {confidence.dataQuality.map((it) => (
              <ConfidenceRow key={it.label} item={it} tone="cyan" />
            ))}
          </div>
        </div>
        <div className={styles.callout}>
          <p className={styles.calloutLabel}>{confidence.summary.label}</p>
          <p className={styles.calloutDescription}>
            {confidence.summary.description}
          </p>
        </div>
      </Card.Body>
    </Card>
  );
}
