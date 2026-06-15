import { useState } from "react";
import {
  DateRangePicker,
  Select,
  type DateRange,
} from "../../../shared/ui";
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
  // TODO(api): swap single-option list for query-driven choices.
  const [v, setV] = useState(value);
  return (
    <Select
      value={v}
      onValueChange={setV}
      icon={lucideIcon(icon, 14)}
      ariaLabel={ariaLabel}
    >
      <Select.Item value={value}>{value}</Select.Item>
    </Select>
  );
}

function DateRangeChip({ label, value }: { label?: string; value: string }) {
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  return (
    <div className={styles.group}>
      {label && <span className={styles.compareLabel}>{label}</span>}
      <DateRangePicker value={range} onChange={setRange} label={value} />
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
