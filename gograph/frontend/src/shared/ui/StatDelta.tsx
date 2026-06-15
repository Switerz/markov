import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "./cn";
import styles from "./StatDelta.module.css";

export type StatTone = "positive" | "negative" | "neutral" | "warning";

export type StatDeltaProps = {
  value: string;
  label?: string;
  tone: StatTone;
  className?: string;
};

const icons = {
  positive: ArrowUpRight,
  negative: ArrowDownRight,
  warning: ArrowDownRight,
  neutral: Minus,
} as const;

export function StatDelta({ value, label, tone, className }: StatDeltaProps) {
  const Icon = icons[tone];
  return (
    <span className={cn(styles.root, styles[tone], className)}>
      <Icon size={14} aria-hidden />
      <span className={styles.value}>{value}</span>
      {label && <span className={styles.label}>{label}</span>}
    </span>
  );
}
