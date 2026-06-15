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
  /** When true, renders without elevated card chrome — use inside Drawers / other Cards. */
  flat?: boolean;
  className?: string;
};

export function MetricCard({
  title,
  value,
  subtitle,
  delta,
  icon,
  tone,
  flat = false,
  className,
}: MetricCardProps) {
  const content = (
    <>
      <div className={styles.head}>
        <IconTile tone={tone} size="sm">{icon}</IconTile>
        <h2 className={styles.title}>{title}</h2>
      </div>
      <div className={styles.value}>{value}</div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      {delta && (
        <div className={styles.delta}>
          <StatDelta value={delta.value} label={delta.label} tone={delta.tone} />
        </div>
      )}
    </>
  );
  if (flat) {
    return <div className={cn(styles.root, styles.flat, className)}>{content}</div>;
  }
  return <Card className={cn(styles.root, className)}>{content}</Card>;
}
