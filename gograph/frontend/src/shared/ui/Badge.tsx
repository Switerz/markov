import { type HTMLAttributes } from "react";
import { cn } from "./cn";
import type { Tone } from "../tokens/tokens";
import styles from "./Badge.module.css";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  variant?: "solid" | "soft" | "outline";
  size?: "sm" | "md";
};

export function Badge({
  tone = "neutral",
  variant = "soft",
  size = "md",
  className,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        styles.badge,
        styles[`tone_${tone}`],
        styles[`variant_${variant}`],
        styles[size],
        className,
      )}
      {...rest}
    />
  );
}
