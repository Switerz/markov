import { Badge, Button, Card } from "../../../shared/ui";
import { channelIcon, channelInitial } from "../../../shared/icons/channelIcons";
import type { PriorityDecision } from "../types";
import styles from "./DecisionCard.module.css";

export type DecisionCardProps = {
  decision: PriorityDecision;
  onViewChannel?: (channel: string) => void;
  onCreateScenario?: (channel: string) => void;
};

export function DecisionCard({
  decision,
  onViewChannel,
  onCreateScenario,
}: DecisionCardProps) {
  const icon = channelIcon(decision.channel, 16);
  function handle(action: string) {
    if (action === "Ver canal") onViewChannel?.(decision.channel);
    else if (action === "Criar cenário") onCreateScenario?.(decision.channel);
  }
  return (
    <Card className={styles.root}>
      <div className={styles.head}>
        <div className={styles.channel}>
          <span className={styles.channelIcon} aria-hidden>
            {icon ?? channelInitial(decision.channel)}
          </span>
          <span className={styles.channelName}>{decision.channel}</span>
        </div>
        <Badge tone={decision.tone} variant="soft">
          {decision.recommendation}
        </Badge>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Spend</span>
          <span className={styles.statValue}>{decision.shareSpend}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Receita</span>
          <span className={styles.statValue}>{decision.shareRevenue}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>ROAS</span>
          <span className={styles.statValue}>{decision.roas}</span>
        </div>
      </div>

      <p className={styles.description}>{decision.description}</p>

      <div className={styles.actions}>
        {decision.actions.map((a) => (
          <Button key={a} variant="secondary" size="sm" onClick={() => handle(a)}>
            {a}
          </Button>
        ))}
      </div>
    </Card>
  );
}
