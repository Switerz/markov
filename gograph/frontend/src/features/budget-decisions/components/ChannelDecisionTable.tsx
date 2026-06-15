import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  Card,
  Badge,
  DataTable,
  StatDelta,
  ProgressBar,
  Button,
  type StatTone,
} from "../../../shared/ui";
import {
  channelIcon,
  channelInitial,
} from "../../../shared/icons/channelIcons";
import type { ChannelTableRow, ChannelsTableData } from "../types";
import type { Tone } from "../../../shared/tokens/tokens";
import styles from "./ChannelDecisionTable.module.css";

export type ChannelDecisionTableProps = {
  data: ChannelsTableData;
  onSelect: (channel: string) => void;
  selectedChannel?: string | null;
};

// Returns the StatDelta tone based on the sign of a "+18,6%" / "-9,7%" string.
const parseDeltaSign = (s: string): StatTone =>
  s.trim().startsWith("-") ? "negative" : "positive";

// Parses "92%" → 0.92. Falls back to 0.
const parseConsensus = (s: string): number => {
  const n = Number(s.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n / 100 : 0;
};

const consensusTone = (value: number): Tone => {
  if (value >= 0.8) return "green";
  if (value >= 0.6) return "orange";
  return "red";
};

function ChannelCell({ channel }: { channel: string }) {
  const icon = channelIcon(channel, 14);
  return (
    <span className={styles.channel}>
      <span className={styles.channelIcon} aria-hidden>
        {icon ?? channelInitial(channel)}
      </span>
      <span className={styles.channelName}>{channel}</span>
    </span>
  );
}

function ValueWithDelta({ value, delta }: { value: string; delta: string }) {
  return (
    <div className={styles.valueStack}>
      <span className={styles.valueMain}>{value}</span>
      <StatDelta value={delta} tone={parseDeltaSign(delta)} />
    </div>
  );
}

function PresenceDots({ presence }: { presence: number }) {
  const dots = [0, 1, 2, 3, 4];
  return (
    <span
      className={styles.presence}
      aria-label={`Presença ${presence} de 5`}
    >
      {dots.map((i) => (
        <span
          key={i}
          className={styles.presenceDot}
          style={{
            background: i < presence ? "var(--gg-blue)" : "var(--gg-border)",
          }}
        />
      ))}
    </span>
  );
}

const helper = createColumnHelper<ChannelTableRow>();

export function ChannelDecisionTable({
  data,
  onSelect,
  selectedChannel,
}: ChannelDecisionTableProps) {
  const columns = useMemo<ColumnDef<ChannelTableRow, unknown>[]>(
    // TanStack's accessor helper produces a typed `ColumnDef<TData, TValue>` per
    // column, but our shared DataTable normalizes to `unknown`. We cast the
    // assembled array as the per-cell types are already enforced by the helper.
    () => ([
      helper.accessor("channel", {
        header: "Canal",
        cell: (info) => <ChannelCell channel={info.getValue()} />,
      }),
      helper.accessor("recommendation", {
        header: "Recomendação",
        cell: (info) => (
          <Badge tone={info.row.original.tone} variant="soft">
            {info.getValue()}
          </Badge>
        ),
      }),
      helper.accessor("spend", {
        header: "Spend (R$)",
        cell: (info) => (
          <ValueWithDelta
            value={info.getValue()}
            delta={info.row.original.spendDelta}
          />
        ),
      }),
      helper.accessor("revenue", {
        header: "Receita atribuída (R$)",
        cell: (info) => (
          <ValueWithDelta
            value={info.getValue()}
            delta={info.row.original.revenueDelta}
          />
        ),
      }),
      helper.accessor("roasMarkov", {
        header: "ROAS Markov",
        cell: (info) => (
          <ValueWithDelta
            value={info.getValue()}
            delta={info.row.original.roasMarkovDelta}
          />
        ),
      }),
      helper.accessor("roasShapley", {
        header: "ROAS Shapley",
        cell: (info) => (
          <ValueWithDelta
            value={info.getValue()}
            delta={info.row.original.roasShapleyDelta}
          />
        ),
      }),
      helper.accessor("consensus", {
        header: "Consenso",
        cell: (info) => {
          const v = parseConsensus(info.getValue());
          return (
            <div className={styles.consensusCell}>
              <span className={styles.consensusValue}>{info.getValue()}</span>
              <ProgressBar value={v} tone={consensusTone(v)} />
            </div>
          );
        },
      }),
      helper.accessor("role", {
        header: "Papel",
        cell: (info) => (
          <span className={styles.role}>{info.getValue()}</span>
        ),
      }),
      helper.accessor("presence", {
        header: "Presença",
        cell: (info) => <PresenceDots presence={info.getValue()} />,
      }),
      helper.display({
        id: "action",
        header: "Ação",
        cell: (info) => (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Abrir detalhes de ${info.row.original.channel}`}
            iconLeft={<ChevronRight size={16} />}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(info.row.original.channel);
            }}
          />
        ),
      }),
    ]) as ColumnDef<ChannelTableRow, unknown>[],
    [onSelect],
  );

  return (
    <Card className={styles.root}>
      <Card.Header>
        <Card.Title>{data.title}</Card.Title>
      </Card.Header>
      <Card.Body className={styles.body}>
        <DataTable<ChannelTableRow>
          columns={columns}
          data={data.rows}
          searchPlaceholder="Buscar canal"
          enableColumnVisibility
          onRowClick={(row) => onSelect(row.channel)}
          selectedRowId={selectedChannel ?? undefined}
          getRowId={(row) => row.channel}
          pageSize={10}
        />
      </Card.Body>
      <Card.Footer>
        <span className={styles.pagination}>{data.pagination}</span>
      </Card.Footer>
    </Card>
  );
}
