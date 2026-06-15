import { Calendar } from "lucide-react";
import { TopBar, type Crumb } from "../../../app/TopBar";
import { Badge, Button, Select } from "../../../shared/ui";
import { channelIcon, channelInitial } from "../../../shared/icons/channelIcons";
import { lucideIcon } from "../icons";
import type {
  ChannelAction,
  ChannelFilter,
  ChannelScreenMeta,
} from "../types";
import styles from "./ChannelHeader.module.css";

export type ChannelHeaderProps = {
  meta: ChannelScreenMeta;
  filters: ChannelFilter[];
  actions: ChannelAction[];
};

// Map the breadcrumb labels to the routes the app actually exposes.
// "GoGraph" → "/"; "Decisões de Budget" → "/decisoes-de-budget";
// "Canal 360" (last item) renders as text with no link.
function breadcrumbCrumbs(labels: string[]): Crumb[] {
  const routes: Record<string, string> = {
    GoGraph: "/",
    "Decisões de Budget": "/decisoes-de-budget",
  };
  return labels.map((label, i) => {
    const isLast = i === labels.length - 1;
    if (isLast) return { label };
    return { label, to: routes[label] ?? "/" };
  });
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

function SelectChip({
  value,
  icon,
  ariaLabel,
}: {
  value: string;
  icon?: string;
  ariaLabel: string;
}) {
  return (
    <Select
      value={value}
      icon={icon ? lucideIcon(icon, 14) : undefined}
      ariaLabel={ariaLabel}
    >
      <Select.Item value={value}>{value}</Select.Item>
    </Select>
  );
}

function ChannelTitle({ meta }: { meta: ChannelScreenMeta }) {
  const icon = channelIcon(meta.channel.name, 16);
  return (
    <span className={styles.title}>
      <span className={styles.logo} aria-hidden>
        {icon ?? channelInitial(meta.channel.name)}
      </span>
      <span className={styles.name}>{meta.channel.name}</span>
      <Badge tone={meta.channel.recommendationTone} variant="soft">
        {meta.channel.recommendation}
      </Badge>
    </span>
  );
}

function ChannelFilters({ filters }: { filters: ChannelFilter[] }) {
  return (
    <div className={styles.filtersRoot}>
      {filters.map((f) => {
        if (f.type === "dateRange") {
          return <DateRangeChip key={f.id} label={f.label} value={f.value} />;
        }
        // select
        return (
          <SelectChip
            key={f.id}
            value={f.value}
            icon={f.icon}
            ariaLabel={f.label ?? f.id}
          />
        );
      })}
    </div>
  );
}

function ChannelActions({ actions }: { actions: ChannelAction[] }) {
  return (
    <>
      {actions.map((a) => (
        <Button
          key={a.id}
          variant={a.variant}
          iconLeft={lucideIcon(a.icon, 16)}
        >
          {a.label}
        </Button>
      ))}
    </>
  );
}

export function ChannelHeader({ meta, filters, actions }: ChannelHeaderProps) {
  return (
    <TopBar
      breadcrumb={breadcrumbCrumbs(meta.breadcrumb)}
      title={<ChannelTitle meta={meta} />}
      filters={<ChannelFilters filters={filters} />}
      actions={<ChannelActions actions={actions} />}
    />
  );
}
