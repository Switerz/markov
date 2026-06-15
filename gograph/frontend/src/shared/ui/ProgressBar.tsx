import type { Tone } from "../tokens/tokens";
import { cn } from "./cn";
import styles from "./ProgressBar.module.css";

export type ProgressBarProps = {
  value: number; // 0..1
  tone?: Tone;
  label?: string;
  rightLabel?: string;
  className?: string;
};

export function ProgressBar({
  value,
  tone = "blue",
  label,
  rightLabel,
  className,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className={cn(styles.root, className)}>
      {(label || rightLabel) && (
        <div className={styles.labels}>
          {label && <span className={styles.label}>{label}</span>}
          {rightLabel && <span className={styles.rightLabel}>{rightLabel}</span>}
        </div>
      )}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(styles.fill, styles[`tone_${tone}`])}
          style={{ transform: `scaleX(${pct})` }}
        />
      </div>
    </div>
  );
}
