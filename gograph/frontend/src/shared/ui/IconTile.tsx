import { type ReactNode } from "react";
import type { Tone } from "../tokens/tokens";
import { cn } from "./cn";
import styles from "./IconTile.module.css";

export type IconTileProps = {
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
};

export function IconTile({
  tone = "blue",
  size = "md",
  children,
  className,
}: IconTileProps) {
  return (
    <span
      className={cn(styles.root, styles[`tone_${tone}`], styles[size], className)}
      aria-hidden
    >
      {children}
    </span>
  );
}
