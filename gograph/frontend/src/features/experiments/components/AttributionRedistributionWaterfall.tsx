import { Card } from "../../../shared/ui";
import { WaterfallChart } from "../../../shared/charts";
import type { RedistributionChart } from "../types";
import styles from "./AttributionRedistributionWaterfall.module.css";

export type AttributionRedistributionWaterfallProps = {
  redistribution: RedistributionChart;
};

export function AttributionRedistributionWaterfall({
  redistribution,
}: AttributionRedistributionWaterfallProps) {
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
        <WaterfallChart steps={redistribution.waterfall} />
      </Card.Body>
      <Card.Footer>
        <p className={styles.note}>{redistribution.note}</p>
      </Card.Footer>
    </Card>
  );
}
