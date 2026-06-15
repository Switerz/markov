import { Calendar } from "lucide-react";
import { Select } from "../../../shared/ui";
import { lucideIcon } from "../icons";
import type { BudgetDecisionsFilter } from "../types";
import styles from "./BudgetDecisionFilters.module.css";

export type BudgetDecisionFiltersProps = {
  filters: BudgetDecisionsFilter[];
};

function SelectChip({
  value,
  icon,
  ariaLabel,
}: {
  value: string;
  icon: string;
  ariaLabel: string;
}) {
  return (
    <Select value={value} icon={lucideIcon(icon, 14)} ariaLabel={ariaLabel}>
      <Select.Item value={value}>{value}</Select.Item>
    </Select>
  );
}

function DateRangeChip({ label, value }: { label?: string; value: string }) {
  return (
    <div className={styles.group}>
      {label && <span className={styles.compareLabel}>{label}</span>}
      <button
        type="button"
        className={styles.dateChip}
        aria-label={label ? `${label} ${value}` : `Período ${value}`}
      >
        <Calendar size={14} aria-hidden className={styles.dateIcon} />
        <span>{value}</span>
      </button>
    </div>
  );
}

export function BudgetDecisionFilters({ filters }: BudgetDecisionFiltersProps) {
  return (
    <div className={styles.root}>
      {filters.map((f) => {
        if (f.type === "select" && f.icon) {
          return (
            <SelectChip
              key={f.id}
              value={f.value}
              icon={f.icon}
              ariaLabel={f.id}
            />
          );
        }
        if (f.type === "dateRange") {
          return (
            <DateRangeChip key={f.id} label={f.label} value={f.value} />
          );
        }
        return null;
      })}
    </div>
  );
}
