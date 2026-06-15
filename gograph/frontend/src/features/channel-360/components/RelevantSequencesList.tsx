import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { Card, Badge } from "../../../shared/ui";
import {
  channelIcon,
  channelInitial,
} from "../../../shared/icons/channelIcons";
import type { RelevantSequence, RelevantSequences } from "../types";
import styles from "./RelevantSequencesList.module.css";

export type RelevantSequencesListProps = {
  sequences: RelevantSequences;
};

function SequencePath({ path }: { path: string[] }) {
  return (
    <span className={styles.path}>
      {path.map((channel, i) => {
        const icon = channelIcon(channel, 14);
        return (
          <Fragment key={`${channel}-${i}`}>
            <span className={styles.pathChip}>
              <span aria-hidden>{icon ?? channelInitial(channel)}</span>
              <span>{channel}</span>
            </span>
            {i < path.length - 1 && (
              <ChevronRight
                size={14}
                aria-hidden
                className={styles.arrow}
              />
            )}
          </Fragment>
        );
      })}
    </span>
  );
}

function SequenceRow({ item }: { item: RelevantSequence }) {
  return (
    <div className={styles.item}>
      <SequencePath path={item.path} />
      <div className={styles.stats}>
        <Badge tone="green" variant="soft">
          {item.uplift}
        </Badge>
        <span className={styles.stat}>
          <span className={styles.statLabel}>Frequência (mediana)</span>
          <span className={styles.statValue}>{item.frequencyMedian}</span>
        </span>
        <span className={styles.stat}>
          <span className={styles.statLabel}>Baseline</span>
          <span className={styles.statValue}>{item.baseline}</span>
        </span>
        <span className={styles.stat}>
          <span className={styles.statLabel}>Conversão da sequência</span>
          <span className={styles.statValue}>{item.sequenceConversion}</span>
        </span>
      </div>
      <button type="button" className={styles.actionLink}>
        {item.action}
      </button>
    </div>
  );
}

export function RelevantSequencesList({ sequences }: RelevantSequencesListProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{sequences.title}</Card.Title>
        <Card.Description>{sequences.subtitle}</Card.Description>
      </Card.Header>
      <Card.Body>
        <div className={styles.list}>
          {sequences.items.map((item, i) => (
            <SequenceRow key={`${i}-${item.path.join("-")}`} item={item} />
          ))}
        </div>
        <p className={styles.note}>{sequences.note}</p>
      </Card.Body>
    </Card>
  );
}
