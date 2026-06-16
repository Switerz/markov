import { useMemo } from "react";
import { Card } from "../../../shared/ui";
import { WaterfallChart } from "../../../shared/charts";
import type { RedistributionChart, WaterfallStepData } from "../types";
import styles from "./AttributionRedistributionWaterfall.module.css";

export type AttributionRedistributionWaterfallProps = {
  redistribution: RedistributionChart;
  /** When provided, positive/negative step magnitudes scale linearly by
   * intensityPct/100. Bridge/start/end steps remain anchored. */
  intensityPct?: number;
};

function scaleSteps(
  steps: WaterfallStepData[],
  factor: number,
): WaterfallStepData[] {
  return steps.map((s) => {
    if (s.type !== "positive" && s.type !== "negative") return s;
    const scaled = s.value * factor;
    // Re-render display with same precision/sign convention.
    const sign = scaled > 0 ? "+" : "";
    const magnitude = Math.abs(scaled).toFixed(2).replace(".", ",");
    const display = `${sign}${scaled < 0 ? "-" : ""}${magnitude}M`;
    return { ...s, value: scaled, display };
  });
}

export function AttributionRedistributionWaterfall({
  redistribution,
  intensityPct,
}: AttributionRedistributionWaterfallProps) {
  const waterfall = useMemo<WaterfallStepData[]>(() => {
    if (intensityPct == null || intensityPct === 100) {
      return redistribution.waterfall;
    }
    return scaleSteps(redistribution.waterfall, intensityPct / 100);
  }, [redistribution.waterfall, intensityPct]);

  return (
    <Card>
      <Card.Header>
        <div className={styles.headerRow}>
          <div className={styles.titles}>
            <Card.Title>{redistribution.title}</Card.Title>
            <Card.Description>{redistribution.subtitle}</Card.Description>
          </div>
          <span className={styles.controlChip}>{redistribution.control}</span>
        </div>
      </Card.Header>
      <Card.Body>
        <WaterfallChart steps={waterfall} />
      </Card.Body>
      <Card.Footer>
        <p className={styles.note}>{redistribution.note}</p>
      </Card.Footer>
    </Card>
  );
}
