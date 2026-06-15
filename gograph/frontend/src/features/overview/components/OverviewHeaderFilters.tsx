import { DateRangePicker, Select, type DateRange } from "../../../shared/ui";
import { useRunsList } from "../../../app/hooks/useActiveRun";
import { lucideIcon } from "../icons";
import type {
  FilterItem,
  FilterAccount,
  FilterDateRange,
  FilterExecution,
  FilterConfidence,
} from "../types";
import type { OverviewFilters } from "../hooks/useOverviewFilters";
import styles from "./OverviewHeaderFilters.module.css";

export type OverviewHeaderFiltersProps = {
  filters: FilterItem[];
  values: OverviewFilters;
  onChange: <K extends keyof OverviewFilters>(
    key: K,
    value: OverviewFilters[K],
  ) => void;
};

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

function AccountFilter({
  filter,
  value,
  onChange,
}: {
  filter: FilterAccount;
  value: string;
  onChange: (v: string) => void;
}) {
  // Single option for now — the menu opens but only "GoCase" is selectable.
  // TODO(api): expand once multi-account selection lands.
  const options = [filter.value];
  return (
    <Select
      value={value}
      onValueChange={onChange}
      icon={lucideIcon(filter.icon, 14)}
      ariaLabel="Conta"
    >
      {options.map((o) => (
        <Select.Item key={o} value={o}>
          {o}
        </Select.Item>
      ))}
    </Select>
  );
}

function ExecutionFilter({
  filter,
  value,
  onChange,
}: {
  filter: FilterExecution;
  value: string | null;
  onChange: (v: string) => void;
}) {
  const { data: runs } = useRunsList();
  const runOptions =
    runs && runs.length > 0
      ? runs.map((r) => ({
          value: String(r.id),
          label: `Execução: v${r.start_date} → ${r.end_date}`,
        }))
      : [{ value: "__mock__", label: filter.value }];
  const selected = value ?? runOptions[0].value;
  return (
    <Select
      value={selected}
      onValueChange={onChange}
      icon={lucideIcon(filter.icon, 14)}
      ariaLabel="Execução"
    >
      {runOptions.map((o) => (
        <Select.Item key={o.value} value={o.value}>
          {o.label}
        </Select.Item>
      ))}
    </Select>
  );
}

function DateRangeChip({
  filter,
  value,
  onChange,
}: {
  filter: FilterDateRange;
  value: DateRange;
  onChange: (v: DateRange) => void;
}) {
  return (
    <div className={styles.group}>
      {filter.label && (
        <span className={styles.compareLabel}>{filter.label}</span>
      )}
      <DateRangePicker value={value} onChange={onChange} label={filter.value} />
    </div>
  );
}

export function OverviewHeaderFilters({
  filters,
  values,
  onChange,
}: OverviewHeaderFiltersProps) {
  return (
    <div className={styles.root}>
      {filters.map((f) => {
        if (isAccount(f)) {
          return (
            <AccountFilter
              key={f.id}
              filter={f}
              value={values.account}
              onChange={(v) => onChange("account", v)}
            />
          );
        }
        if (isExecution(f)) {
          return (
            <ExecutionFilter
              key={f.id}
              filter={f}
              value={values.executionId}
              onChange={(v) => onChange("executionId", v)}
            />
          );
        }
        if (isDateRange(f)) {
          if (f.id === "compareWith") {
            return (
              <DateRangeChip
                key={f.id}
                filter={f}
                value={values.compareWith}
                onChange={(v) => onChange("compareWith", v)}
              />
            );
          }
          return (
            <DateRangeChip
              key={f.id}
              filter={f}
              value={values.period}
              onChange={(v) => onChange("period", v)}
            />
          );
        }
        if (isConfidence(f)) {
          return <ConfidenceChip key={f.id} filter={f} />;
        }
        // Help TS exhaustiveness without breaking on unknown filter types.
        void (f as never);
        return null;
      })}
    </div>
  );
}

