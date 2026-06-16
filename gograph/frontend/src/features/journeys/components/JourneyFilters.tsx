import { useState } from "react";
import { Users, Calendar } from "lucide-react";
import {
  Select,
  Switch,
  DateRangePicker,
  type DateRange,
} from "../../../shared/ui";
import type { JourneyFilter } from "../types";
import type {
  JourneyFiltersState,
  JourneyLengthBucket,
} from "../hooks/useJourneysData";
import styles from "./JourneyFilters.module.css";

export type JourneyFiltersProps = {
  filters: JourneyFilter[];
  state: JourneyFiltersState;
  onChange: <K extends keyof JourneyFiltersState>(
    key: K,
    value: JourneyFiltersState[K],
  ) => void;
  /** Channel pool for origin/destination selectors. */
  channelOptions: string[];
};

const iconMap: Record<string, (size?: number) => React.ReactNode> = {
  Users: (size = 14) => <Users size={size} aria-hidden />,
  Calendar: (size = 14) => <Calendar size={size} aria-hidden />,
};

const LENGTH_OPTIONS: { value: JourneyLengthBucket; label: string }[] = [
  { value: "all", label: "Todos os comprimentos" },
  { value: "1", label: "1 toque" },
  { value: "2", label: "2 toques" },
  { value: "3-5", label: "3 a 5 toques" },
  { value: "6-10", label: "6 a 10 toques" },
  { value: "10+", label: "10+ toques" },
];

export function JourneyFilters({
  filters,
  state,
  onChange,
  channelOptions,
}: JourneyFiltersProps) {
  return (
    <div className={styles.root}>
      {filters.map((f) => (
        <FilterChip
          key={f.id}
          filter={f}
          state={state}
          onChange={onChange}
          channelOptions={channelOptions}
        />
      ))}
    </div>
  );
}

type ChipProps = {
  filter: JourneyFilter;
  state: JourneyFiltersState;
  onChange: JourneyFiltersProps["onChange"];
  channelOptions: string[];
};

function FilterChip({ filter, state, onChange, channelOptions }: ChipProps) {
  if (filter.type === "select") {
    if (filter.id === "journeyLength") {
      return (
        <Select
          value={state.journeyLength}
          onValueChange={(v) =>
            onChange("journeyLength", v as JourneyLengthBucket)
          }
          ariaLabel={filter.label ?? "Comprimento da jornada"}
        >
          {LENGTH_OPTIONS.map((o) => (
            <Select.Item key={o.value} value={o.value}>
              {o.label}
            </Select.Item>
          ))}
        </Select>
      );
    }
    if (filter.id === "origin") {
      return (
        <Select
          value={state.origin}
          onValueChange={(v) => onChange("origin", v)}
          ariaLabel={filter.label ?? "Origem"}
        >
          <Select.Item value="all">Todos os canais</Select.Item>
          {channelOptions.map((c) => (
            <Select.Item key={c} value={c}>
              {c}
            </Select.Item>
          ))}
        </Select>
      );
    }
    if (filter.id === "destination") {
      return (
        <Select
          value={state.destination}
          onValueChange={(v) => onChange("destination", v)}
          ariaLabel={filter.label ?? "Destino"}
        >
          <Select.Item value="all">Qualquer destino</Select.Item>
          <Select.Item value="Conversão">Conversão</Select.Item>
          {channelOptions.map((c) => (
            <Select.Item key={c} value={c}>
              {c}
            </Select.Item>
          ))}
        </Select>
      );
    }
    return <SelectFilter filter={filter} />;
  }
  if (filter.type === "dateRange") {
    return <DateFilter filter={filter} />;
  }
  if (filter.label === "Ocultar diretos") {
    return (
      <ControlledSwitch
        id="hideDirect"
        label={filter.label}
        checked={state.hideDirect}
        onChange={(v) => onChange("hideDirect", v)}
      />
    );
  }
  if (filter.label === "Ocultar self-loops") {
    return (
      <ControlledSwitch
        id="hideSelfLoops"
        label={filter.label}
        checked={state.hideSelfLoops}
        onChange={(v) => onChange("hideSelfLoops", v)}
      />
    );
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
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  return (
    <DateRangePicker value={range} onChange={setRange} label={filter.value} />
  );
}

function ControlledSwitch({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const inputId = `journey-filter-${id}`;
  return (
    <label htmlFor={inputId} className={styles.switchGroup}>
      <Switch
        id={inputId}
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
      />
      <span>{label}</span>
    </label>
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
