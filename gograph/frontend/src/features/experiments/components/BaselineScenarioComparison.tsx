import { Card, StatDelta } from "../../../shared/ui";
import type {
  BaselineVsScenario,
  ComparisonColumn,
  ComparisonMetric,
} from "../types";
import styles from "./BaselineScenarioComparison.module.css";

export type BaselineScenarioComparisonProps = {
  data: BaselineVsScenario;
};

type ColumnTone = "baseline" | "scenario" | "delta";

function MetricRow({ metric }: { metric: ComparisonMetric }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{metric.label}</span>
      <span className={styles.rowValue}>
        <span className={styles.value}>{metric.value}</span>
        {metric.delta && metric.tone && (
          <StatDelta value={metric.delta} tone={metric.tone} />
        )}
      </span>
    </div>
  );
}

function Column({
  column,
  tone,
}: {
  column: ComparisonColumn;
  tone: ColumnTone;
}) {
  return (
    <div className={styles.column} data-tone={tone}>
      <header className={styles.colHeader} data-tone={tone}>
        <span className={styles.colTitle}>{column.title}</span>
        {column.period && <span className={styles.colPeriod}>{column.period}</span>}
      </header>
      <div className={styles.colBody}>
        {column.metrics.map((m) => (
          <MetricRow key={m.label} metric={m} />
        ))}
      </div>
    </div>
  );
}

export function BaselineScenarioComparison({
  data,
}: BaselineScenarioComparisonProps) {
  return (
    <Card>
      <Card.Header>
        <div className={styles.headerRow}>
          <Card.Title>{data.title}</Card.Title>
          <ul className={styles.legend} aria-label="Legenda">
            {data.legend.map((item) => (
              <li key={item.label} className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  data-tone={item.tone}
                  aria-hidden
                />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </Card.Header>
      <Card.Body>
        <div className={styles.grid}>
          <Column column={data.baseline} tone="baseline" />
          <Column column={data.scenario} tone="scenario" />
          <Column column={data.delta} tone="delta" />
        </div>
      </Card.Body>
    </Card>
  );
}
