import { Card, Button, Select, ProgressBar } from "../../../shared/ui";
import { channelIcon } from "../../../shared/icons/channelIcons";
import type { LoopsPatterns } from "../types";
import { parsePercent } from "./JourneySankeyPanel";
import styles from "./LoopsPatternsList.module.css";

export type LoopsPatternsListProps = {
  loops: LoopsPatterns;
};

function leadChannelFromPattern(pattern: string): string {
  return pattern.split(/\s*→\s*|\s*->\s*/)[0] ?? "";
}

export function LoopsPatternsList({ loops }: LoopsPatternsListProps) {
  return (
    <Card>
      <Card.Header>
        <div className={styles.headerWrap}>
          <div className={styles.headerText}>
            <Card.Title>{loops.title}</Card.Title>
          </div>
          <div className={styles.headerRight}>
            <Select value={loops.filter} ariaLabel="Filtro de padrões">
              <Select.Item value={loops.filter}>{loops.filter}</Select.Item>
            </Select>
          </div>
        </div>
      </Card.Header>
      <Card.Body>
        <div className={styles.list}>
          {loops.items.map((item) => {
            const lead = leadChannelFromPattern(item.pattern);
            const participation = parsePercent(item.participation);
            const conversion = parsePercent(item.conversion);
            return (
              <div key={item.pattern} className={styles.item}>
                <span className={styles.patternRow}>
                  {channelIcon(lead, 14)}
                  {item.pattern}
                </span>
                <span className={styles.description}>{item.description}</span>
                <div className={styles.bars}>
                  <div className={styles.barWrap}>
                    <div className={styles.barCaption}>
                      <span>Participação</span>
                      <span>{item.participation}</span>
                    </div>
                    <ProgressBar value={participation} tone={item.tone} />
                  </div>
                  <div className={styles.barWrap}>
                    <div className={styles.barCaption}>
                      <span>Conversão</span>
                      <span>{item.conversion}</span>
                    </div>
                    <ProgressBar value={conversion} tone={item.tone} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card.Body>
      <Card.Footer>
        <div className={styles.footerAction}>
          <Button variant="ghost" size="sm">
            {loops.action}
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
}
