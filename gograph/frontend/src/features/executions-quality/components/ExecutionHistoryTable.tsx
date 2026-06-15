import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ListFilter, Search, EllipsisVertical } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DataTable,
  cn,
} from "../../../shared/ui";
import type { Tone } from "../../../shared/tokens/tokens";
import type {
  ConfidenceBadge,
  ExecutionHistory,
  ExecutionHistoryRow,
  ExecutionStatusTone,
} from "../types";
import styles from "./ExecutionHistoryTable.module.css";

export type ExecutionHistoryTableProps = {
  history: ExecutionHistory;
  selectedId?: string;
  onSelect: (id: string) => void;
};

const statusToneMap: Record<ExecutionStatusTone, Tone> = {
  green: "green",
  blue: "blue",
  orange: "orange",
  red: "red",
  neutral: "neutral",
};

const confidenceBadgeTone: Record<ConfidenceBadge, Tone> = {
  Alta: "green",
  Média: "orange",
  Baixa: "red",
  "—": "neutral",
};

export function ExecutionHistoryTable({
  history,
  selectedId,
  onSelect,
}: ExecutionHistoryTableProps) {
  const searchControl = history.controls.find((c) => c.id === "search");
  const filterControl = history.controls.find((c) => c.id === "filter");
  const searchPlaceholder = searchControl?.placeholder ?? "Buscar...";
  const [searchValue, setSearchValue] = useState("");

  const columns = useMemo<ColumnDef<ExecutionHistoryRow, unknown>[]>(
    () => [
      {
        id: "period",
        header: history.columns[0],
        accessorKey: "period",
        cell: ({ row }) => (
          <span className={styles.periodCell}>{row.original.period}</span>
        ),
      },
      {
        id: "status",
        header: history.columns[1],
        accessorKey: "status",
        cell: ({ row }) => (
          <Badge tone={statusToneMap[row.original.statusTone]} variant="soft">
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "revenue",
        header: history.columns[2],
        accessorKey: "revenue",
      },
      {
        id: "observedConversion",
        header: history.columns[3],
        accessorKey: "observedConversion",
      },
      {
        id: "modeledConversion",
        header: history.columns[4],
        accessorKey: "modeledConversion",
      },
      {
        id: "confidence",
        header: history.columns[5],
        accessorKey: "confidence",
        cell: ({ row }) => (
          <span className={styles.confidenceCell}>
            <span>{row.original.confidence}</span>
            {row.original.confidenceBadge && (
              <Badge
                size="sm"
                tone={confidenceBadgeTone[row.original.confidenceBadge]}
                variant="soft"
              >
                {row.original.confidenceBadge}
              </Badge>
            )}
          </span>
        ),
      },
      {
        id: "runtime",
        header: history.columns[6],
        accessorKey: "runtime",
      },
      {
        id: "createdBy",
        header: history.columns[7],
        accessorKey: "createdBy",
        cell: ({ row }) => (
          <span className={styles.createdCell}>
            <span className={styles.createdBy}>{row.original.createdBy}</span>
            <span className={styles.createdAt}>{row.original.createdAt}</span>
          </span>
        ),
      },
      {
        id: "actions",
        header: history.columns[8],
        cell: ({ row }) => (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="icon"
                size="sm"
                aria-label={`Ações para ${row.original.period}`}
                onClick={(e) => e.stopPropagation()}
              >
                <EllipsisVertical size={14} />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className={styles.menu}
              >
                <DropdownMenu.Item className={styles.menuItem}>
                  Ver detalhes
                </DropdownMenu.Item>
                <DropdownMenu.Item className={styles.menuItem}>
                  Reexecutar
                </DropdownMenu.Item>
                <DropdownMenu.Item className={styles.menuItem}>
                  Exportar
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        ),
      },
    ],
    [history.columns],
  );

  // Apply the header search to the table data — the shared DataTable's own
  // internal filter UI is suppressed (no `searchPlaceholder` prop) because we
  // render the search input in the Card.Header for visual hierarchy.
  const filteredRows = useMemo(() => {
    if (!searchValue) return history.rows;
    const q = searchValue.toLowerCase();
    return history.rows.filter((r) =>
      [r.period, r.status, r.revenue, r.createdBy, r.createdAt]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [history.rows, searchValue]);

  return (
    <Card>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>{history.title}</h2>
        </div>
        <div className={styles.headerControls}>
          <label className={styles.searchWrap}>
            <Search size={14} aria-hidden className={styles.searchIcon} />
            <input
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={searchPlaceholder}
              className={styles.search}
              aria-label={searchPlaceholder}
            />
          </label>
          <Button variant="ghost" iconLeft={<ListFilter size={14} />}>
            {filterControl?.label ?? "Filtrar"}
          </Button>
        </div>
      </div>
      <div className={styles.body}>
        <DataTable<ExecutionHistoryRow>
          columns={columns}
          data={filteredRows}
          pageSize={5}
          getRowId={(r) => r.id}
          onRowClick={(r) => onSelect(r.id)}
          selectedRowId={selectedId}
        />
      </div>
      <div className={styles.footer}>
        <span className={styles.summary}>{history.pagination.summary}</span>
        <nav aria-label="Paginação" className={styles.pagination}>
          {history.pagination.pages.map((p, i) => {
            if (p === "...") {
              return (
                <span key={`ellipsis-${i}`} className={styles.ellipsis} aria-hidden>
                  …
                </span>
              );
            }
            const isCurrent = p === 1;
            return (
              <button
                key={p}
                type="button"
                aria-current={isCurrent ? "page" : undefined}
                className={cn(styles.pageBtn, isCurrent && styles.pageBtnCurrent)}
              >
                {p}
              </button>
            );
          })}
        </nav>
      </div>
    </Card>
  );
}
