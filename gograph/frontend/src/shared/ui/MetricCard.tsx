import { type ReactNode } from "react";
import { Card } from "./Card";
import { StatDelta, type StatTone } from "./StatDelta";
import { IconTile } from "./IconTile";
import { cn } from "./cn";
import type { Tone } from "../tokens/tokens";
import styles from "./MetricCard.module.css";

export type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  delta?: { value: string; label: string; tone: StatTone };
  icon: ReactNode;
  tone: Tone;
  className?: string;
};

export function MetricCard({
  title,
  value,
  subtitle,
  delta,
  icon,
  tone,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn(styles.root, className)}>
      <div className={styles.head}>
        <IconTile tone={tone}>{icon}</IconTile>
        <h3 className={styles.title}>{title}</h3>
      </div>
      <div className={styles.value}>{value}</div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      {delta && (
        <div className={styles.delta}>
          <StatDelta value={delta.value} label={delta.label} tone={delta.tone} />
        </div>
      )}
    </Card>
  );
}
