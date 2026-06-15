import { Calendar } from "lucide-react";
import { Select } from "../../../shared/ui";
import { lucideIcon } from "../icons";
import type {
  FilterItem,
  FilterAccount,
  FilterDateRange,
  FilterExecution,
  FilterConfidence,
} from "../types";
import styles from "./OverviewHeaderFilters.module.css";

export type OverviewHeaderFiltersProps = { filters: FilterItem[] };

function isAccount(f: FilterItem): f is FilterAccount {
  return f.type === "select" && f.id === "account";
}
function isExecution(f: FilterItem): f is FilterExecution {
  return f.type === "select" && f.id === "execution";
}
function isDateRange(f: FilterItem): f is FilterDateRange {
  return f.type === "dateRange";
}
function isConfidence(f: FilterItem): f is FilterConfidence {
  return f.type === "status";
}

function SelectChip({
  value,
  icon,
  ariaLabel,
}: {
  value: string;
  icon: string;
  ariaLabel: string;
}) {
  // Controlled value mirrors the data; no real options yet — list a single
  // matching item so Radix can render the trigger label correctly.
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

function ConfidenceChip({ filter }: { filter: FilterConfidence }) {
  return (
    <div className={styles.statusChip}>
      <span className={styles.statusLabel}>{filter.label}</span>
      <span
        className={`${styles.statusDot} ${styles[`statusDot_${filter.tone}`] ?? ""}`}
        aria-hidden
      />
      <span>{filter.value}</span>
    </div>
  );
}

export function OverviewHeaderFilters({ filters }: OverviewHeaderFiltersProps) {
  return (
    <div className={styles.root}>
      {filters.map((f) => {
        if (isAccount(f)) {
          return (
            <SelectChip
              key={f.id}
              value={f.value}
              icon={f.icon}
              ariaLabel="Conta"
            />
          );
        }
        if (isExecution(f)) {
          return (
            <SelectChip
              key={f.id}
              value={f.value}
              icon={f.icon}
              ariaLabel="Execução"
            />
          );
        }
        if (isDateRange(f)) {
          return (
            <DateRangeChip key={f.id} label={f.label} value={f.value} />
          );
        }
        if (isConfidence(f)) {
          return <ConfidenceChip key={f.id} filter={f} />;
        }
        return null;
      })}
    </div>
  );
}
