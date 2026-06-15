import { Card, Badge, ProgressBar } from "../../../shared/ui";
import type { AttributionEfficiency } from "../types";
import styles from "./AttributionEfficiencyTable.module.css";

export type AttributionEfficiencyTableProps = {
  efficiency: AttributionEfficiency;
};

export function AttributionEfficiencyTable({
  efficiency,
}: AttributionEfficiencyTableProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{efficiency.title}</Card.Title>
        <Card.Description>{efficiency.subtitle}</Card.Description>
      </Card.Header>
      <Card.Body>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Modelo</th>
              <th scope="col">Participação no investimento</th>
              <th scope="col" className={styles.right}>
                Receita atribuída
              </th>
              <th scope="col" className={styles.right}>
                Participação na receita
              </th>
              <th scope="col">Eficiência relativa</th>
            </tr>
          </thead>
          <tbody>
            {efficiency.rows.map((row) => (
              <tr key={row.model}>
                <td className={styles.model}>{row.model}</td>
                <td>
                  <div className={styles.investmentCell}>
                    <div className={styles.investmentBar}>
                      <ProgressBar value={row.investmentBar / 100} tone="blue" />
                    </div>
                    <span className={styles.investmentShare}>
                      {row.investmentShare}
                    </span>
                  </div>
                </td>
                <td className={styles.right}>{row.attributedRevenue}</td>
                <td className={styles.right}>{row.revenueShare}</td>
                <td>
                  <Badge tone={row.efficiencyTone} variant="soft">
                    {row.relativeEfficiency}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card.Body>
      <Card.Footer>
        <span className={styles.formula}>{efficiency.formula}</span>
      </Card.Footer>
    </Card>
  );
}
