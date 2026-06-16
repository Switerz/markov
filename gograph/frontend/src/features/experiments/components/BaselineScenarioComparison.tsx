import { useMemo } from "react";
import { Card, StatDelta } from "../../../shared/ui";
import type {
  BaselineVsScenario,
  ComparisonColumn,
  ComparisonMetric,
} from "../types";
import styles from "./BaselineScenarioComparison.module.css";

export type ScenarioOverrides = {
  name: string;
  intensityPct: number;
};

export type BaselineScenarioComparisonProps = {
  data: BaselineVsScenario;
  overrides?: ScenarioOverrides;
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

// Scales the numeric portion of a delta string (e.g. "-10,9%", "-0,38pp",
// "+R$ 0,29M") by a factor. Preserves the unit suffix and sign. Returns the
// original string when no numeric part can be parsed.
function scaleDelta(text: string | undefined, factor: number): string | undefined {
  if (!text) return text;
  const match = text.match(/^([+-]?)([^0-9-]*)([0-9.,]+)(.*)$/);
  if (!match) return text;
  const [, sign, prefix, num, suffix] = match;
  const numeric = Number(num.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(numeric)) return text;
  const scaled = numeric * factor;
  const formatted = scaled
    .toFixed(Math.max(1, (num.split(",")[1]?.length ?? 0)))
    .replace(".", ",");
  return `${sign}${prefix}${formatted}${suffix}`;
}

function scaleColumn(
  column: ComparisonColumn,
  factor: number,
): ComparisonColumn {
  return {
    ...column,
    metrics: column.metrics.map((m) => ({
      ...m,
      delta: scaleDelta(m.delta, factor),
    })),
  };
}

export function BaselineScenarioComparison({
  data,
  overrides,
}: BaselineScenarioComparisonProps) {
  const scenarioColumn = useMemo<ComparisonColumn>(() => {
    if (!overrides) return data.scenario;
    const factor = overrides.intensityPct / 100;
    return {
      ...scaleColumn(data.scenario, factor),
      title: `Cenário: ${overrides.name}`,
    };
  }, [data.scenario, overrides]);

  const deltaColumn = useMemo<ComparisonColumn>(() => {
    const base: ComparisonColumn = {
      title: data.delta.title,
      metrics: data.delta.metrics,
    };
    if (!overrides) return base;
    return scaleColumn(base, overrides.intensityPct / 100);
  }, [data.delta, overrides]);

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
          <Column column={scenarioColumn} tone="scenario" />
          <Column column={deltaColumn} tone="delta" />
        </div>
      </Card.Body>
    </Card>
  );
}
