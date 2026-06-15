import { Card, Badge } from "../../../shared/ui";
import {
  channelIcon,
  channelInitial,
} from "../../../shared/icons/channelIcons";
import type {
  OpportunitiesRisksData,
  ScaleOpportunity,
  ReductionRisk,
} from "../types";
import styles from "./OpportunitiesRisksPanel.module.css";

export type OpportunitiesRisksPanelProps = {
  data: OpportunitiesRisksData;
};

function ChannelLabel({ channel }: { channel: string }) {
  const icon = channelIcon(channel, 14);
  return (
    <span className={styles.channel}>
      <span className={styles.channelIcon} aria-hidden>
        {icon ?? channelInitial(channel)}
      </span>
      <span className={styles.channelName}>{channel}</span>
    </span>
  );
}

function OpportunityRow({ row }: { row: ScaleOpportunity }) {
  return (
    <li className={styles.row}>
      <ChannelLabel channel={row.channel} />
      <Badge tone="green" variant="soft" size="sm">
        {row.impact}
      </Badge>
      <span className={styles.meta}>ROAS Markov: {row.roasMarkov}</span>
    </li>
  );
}

function RiskRow({ row }: { row: ReductionRisk }) {
  return (
    <li className={styles.row}>
      <ChannelLabel channel={row.channel} />
      <Badge tone="red" variant="soft" size="sm">
        {row.impact}
      </Badge>
      <span className={styles.meta}>{row.reason}</span>
    </li>
  );
}

export function OpportunitiesRisksPanel({
  data,
}: OpportunitiesRisksPanelProps) {
  return (
    <Card className={styles.root}>
      <Card.Header>
        <Card.Title>{data.title}</Card.Title>
      </Card.Header>
      <Card.Body className={styles.body}>
        <div className={styles.columns}>
          <section className={styles.column}>
            <h3 className={styles.columnTitle}>Oportunidades de escala</h3>
            <ul className={styles.list}>
              {data.scaleOpportunities.map((o) => (
                <OpportunityRow key={o.channel} row={o} />
              ))}
            </ul>
          </section>
          <section className={styles.column}>
            <h3 className={styles.columnTitle}>Riscos de redução</h3>
            <ul className={styles.list}>
              {data.reductionRisks.map((r) => (
                <RiskRow key={r.channel} row={r} />
              ))}
            </ul>
          </section>
        </div>
      </Card.Body>
      <Card.Footer>
        <p className={styles.note}>{data.technicalNote}</p>
      </Card.Footer>
    </Card>
  );
}
