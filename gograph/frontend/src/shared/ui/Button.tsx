import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "icon";
type Size = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    iconLeft,
    iconRight,
    loading,
    className,
    children,
    type = "button",
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        styles.btn,
        styles[variant],
        styles[size],
        loading && styles.loading,
        className,
      )}
      {...rest}
    >
      {iconLeft && (
        <span className={styles.icon} aria-hidden>
          {iconLeft}
        </span>
      )}
      {children && <span className={styles.label}>{children}</span>}
      {iconRight && (
        <span className={styles.icon} aria-hidden>
          {iconRight}
        </span>
      )}
    </button>
  );
});
