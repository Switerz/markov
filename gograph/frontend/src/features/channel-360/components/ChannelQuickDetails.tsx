import { Card } from "../../../shared/ui";
import type { QuickDetails } from "../types";
import styles from "./ChannelQuickDetails.module.css";

export type ChannelQuickDetailsProps = {
  details: QuickDetails;
};

export function ChannelQuickDetails({ details }: ChannelQuickDetailsProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{details.title}</Card.Title>
      </Card.Header>
      <Card.Body>
        <dl className={styles.list}>
          {details.items.map((item) => (
            <div key={item.label} className={styles.row}>
              <dt className={styles.label}>{item.label}</dt>
              <dd className={styles.value}>{item.value}</dd>
            </div>
          ))}
        </dl>
      </Card.Body>
    </Card>
  );
}
