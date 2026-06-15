import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "../shared/ui/cn";
import { ChevronRight } from "lucide-react";
import styles from "./TopBar.module.css";

export type Crumb = { label: string; to?: string };

export type TopBarProps = {
  // `title` accepts a plain string OR a ReactNode so screens like Channel 360
  // can render a logo + channel name + badge inside the heading slot.
  title?: ReactNode;
  subtitle?: string;
  breadcrumb?: Crumb[];
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function TopBar({ title, subtitle, breadcrumb, filters, actions, className }: TopBarProps) {
  return (
    <header className={cn(styles.root, className)}>
      <div className={styles.headRow}>
        <div className={styles.titleBlock}>
          {breadcrumb && breadcrumb.length > 0 && (
            <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
              <ol>
                {breadcrumb.map((c, i) => (
                  <li key={`${c.label}-${i}`}>
                    {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
                    {i < breadcrumb.length - 1 && <ChevronRight aria-hidden width={12} height={12} />}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          {title !== undefined && title !== null && title !== "" && (
            <h1 className={styles.title}>{title}</h1>
          )}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {filters && <div className={styles.filters}>{filters}</div>}
    </header>
  );
}
