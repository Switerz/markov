import { Card, Button, Select } from "../../../shared/ui";
import { TransitionHeatmap } from "../../../shared/charts";
import type { TransitionMatrixData } from "../types";
import styles from "./TransitionMatrixHeatmap.module.css";

export type TransitionMatrixHeatmapProps = {
  matrix: TransitionMatrixData;
};

// Cell values arrive as percentages already (e.g. 23.6 means 23,6%), so we
// format directly with one decimal place rather than dividing by 100.
function formatCell(v: number): string {
  const fixed = v.toFixed(1).replace(".", ",");
  return `${fixed}%`;
}

export function TransitionMatrixHeatmap({
  matrix,
}: TransitionMatrixHeatmapProps) {
  return (
    <Card>
      <Card.Header>
        <div className={styles.headerWrap}>
          <div className={styles.headerText}>
            <Card.Title>{matrix.title}</Card.Title>
          </div>
          <div className={styles.headerRight}>
            <Select value={matrix.metric} ariaLabel="Métrica da matriz">
              <Select.Item value={matrix.metric}>{matrix.metric}</Select.Item>
            </Select>
          </div>
        </div>
      </Card.Header>
      <Card.Body>
        <TransitionHeatmap
          columns={matrix.columns}
          rows={matrix.rows}
          metricLabel="Participação"
          formatCell={formatCell}
        />
      </Card.Body>
      <Card.Footer>
        <div className={styles.footerAction}>
          <Button variant="ghost" size="sm">
            {matrix.action}
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
}
