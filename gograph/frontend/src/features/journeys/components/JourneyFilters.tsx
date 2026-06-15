import { useState } from "react";
import { Users, Calendar } from "lucide-react";
import {
  Select,
  Switch,
  DateRangePicker,
  type DateRange,
} from "../../../shared/ui";
import type { JourneyFilter } from "../types";
import styles from "./JourneyFilters.module.css";

export type JourneyFiltersProps = {
  filters: JourneyFilter[];
};

const iconMap: Record<string, (size?: number) => React.ReactNode> = {
  Users: (size = 14) => <Users size={size} aria-hidden />,
  Calendar: (size = 14) => <Calendar size={size} aria-hidden />,
};

export function JourneyFilters({ filters }: JourneyFiltersProps) {
  // Filters are presentational (display-only). Each control is controlled by
  // a local state seeded from the mock value so it remains interactive.
  return (
    <div className={styles.root}>
      {filters.map((f) => (
        <FilterChip key={f.id} filter={f} />
      ))}
    </div>
  );
}

function FilterChip({ filter }: { filter: JourneyFilter }) {
  if (filter.type === "select") {
    return <SelectFilter filter={filter} />;
  }
  if (filter.type === "dateRange") {
    return <DateFilter filter={filter} />;
  }
  return <SwitchFilter filter={filter} />;
}

function SelectFilter({
  filter,
}: {
  filter: Extract<JourneyFilter, { type: "select" }>;
}) {
  const [value, setValue] = useState(filter.value);
  const icon = filter.icon ? iconMap[filter.icon]?.() : undefined;
  return (
    <Select
      value={value}
      onValueChange={setValue}
      icon={icon}
      ariaLabel={filter.label ?? filter.id}
    >
      <Select.Item value={filter.value}>{filter.value}</Select.Item>
    </Select>
  );
}

function DateFilter({
  filter,
}: {
  filter: Extract<JourneyFilter, { type: "dateRange" }>;
}) {
  // The mock provides a presentation-only string like "01 Mai — 31 Mai 2026".
  // We surface the raw string as the label so the chip mirrors the design.
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  return (
    <DateRangePicker
      value={range}
      onChange={setRange}
      label={filter.value}
    />
  );
}

function SwitchFilter({
  filter,
}: {
  filter: Extract<JourneyFilter, { type: "switch" }>;
}) {
  const [checked, setChecked] = useState(filter.value);
  const id = `journey-filter-${filter.label}`;
  return (
    <label htmlFor={id} className={styles.switchGroup}>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={setChecked}
        aria-label={filter.label}
      />
      <span>{filter.label}</span>
    </label>
  );
}
