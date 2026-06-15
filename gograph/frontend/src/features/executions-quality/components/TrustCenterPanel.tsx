import { Badge, Card, ProgressBar, StatDelta } from "../../../shared/ui";
import type { Tone } from "../../../shared/tokens/tokens";
import type { ConfidenceBadge, TrustCenter } from "../types";

import styles from "./TrustCenterPanel.module.css";

export type TrustCenterPanelProps = {
  trust: TrustCenter;
};

const confidenceBadgeTone: Record<ConfidenceBadge, Tone> = {
  Alta: "green",
  Média: "orange",
  Baixa: "red",
  "—": "neutral",
};

// Same shape used in other phases — accepts "92%", returns 0..1; falls back to
// null when the input has no parseable percentage so callers can render the raw
// label instead of a bar.
function parsePercent(raw: string): number | null {
  const m = raw.trim().match(/^(-?[\d.,]+)\s*%$/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(1, n / 100));
}

function pickTone(value: number): Tone {
  if (value >= 0.9) return "green";
  if (value >= 0.7) return "blue";
  if (value >= 0.5) return "orange";
  return "red";
}

function MetricRow({ label, value }: { label: string; value: string }) {
  const pct = parsePercent(value);
  if (pct === null) {
    return <ProgressBar value={0} label={label} rightLabel={value} tone="neutral" />;
  }
  return (
    <ProgressBar
      value={pct}
      label={label}
      rightLabel={value}
      tone={pickTone(pct)}
    />
  );
}

export function TrustCenterPanel({ trust }: TrustCenterPanelProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{trust.title}</Card.Title>
      </Card.Header>
      <Card.Body>
        <div className={styles.body}>
          <div className={styles.overall}>
            <p className={styles.overallTitle}>Confiança geral</p>
            <div className={styles.overallRow}>
              <span className={styles.overallValue}>
                {trust.overallConfidence.value}
              </span>
              <Badge tone={confidenceBadgeTone[trust.overallConfidence.badge]}>
                {trust.overallConfidence.badge}
              </Badge>
              <StatDelta
                value={trust.overallConfidence.delta}
                tone="positive"
              />
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Calibração do modelo</h3>
            <div className={styles.bars}>
              {trust.modelCalibration.map((m) => (
                <MetricRow key={m.label} label={m.label} value={m.value} />
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Qualidade dos dados</h3>
            <div className={styles.bars}>
              {trust.dataQuality.map((m) => (
                <MetricRow key={m.label} label={m.label} value={m.value} />
              ))}
            </div>
          </div>

          <div className={`${styles.callout} ${styles.calloutAlerts}`}>
            <h3 className={styles.calloutAlertsTitle}>{trust.alerts.title}</h3>
            <ul className={styles.calloutList}>
              {trust.alerts.items.map((item, i) => (
                <li key={i} className={styles.calloutItem}>
                  {item}
                </li>
              ))}
            </ul>
            <button type="button" className={styles.action}>
              {trust.alerts.action}
            </button>
          </div>

          <div className={`${styles.callout} ${styles.calloutChecks}`}>
            <div className={styles.calloutChecksHead}>
              <h3 className={styles.calloutChecksTitle}>{trust.checks.title}</h3>
              <span className={styles.calloutChecksValue}>{trust.checks.value}</span>
            </div>
            <p className={styles.calloutDescription}>{trust.checks.description}</p>
            <button type="button" className={styles.action}>
              {trust.checks.action}
            </button>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
