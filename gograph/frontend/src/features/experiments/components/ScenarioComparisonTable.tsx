import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { EllipsisVertical } from "lucide-react";
import {
  Card,
  DataTable,
  IconTile,
  StatDelta,
  Button,
} from "../../../shared/ui";
import type { StatTone } from "../../../shared/ui/StatDelta";
import type {
  ScenarioComparisonTable as ScenarioComparisonTableData,
  ScenarioRow,
} from "../types";
import styles from "./ScenarioComparisonTable.module.css";

export type ScenarioComparisonTableProps = {
  table: ScenarioComparisonTableData;
};

function deltaTone(delta: string | undefined): StatTone {
  if (!delta) return "neutral";
  if (delta.trim().startsWith("+")) return "positive";
  if (delta.trim().startsWith("-")) return "negative";
  return "neutral";
}

function ValueCell({
  value,
  delta,
}: {
  value: string;
  delta?: string;
}) {
  return (
    <span className={styles.valueCell}>
      <span className={styles.value}>{value}</span>
      {delta && <StatDelta value={delta} tone={deltaTone(delta)} />}
    </span>
  );
}

export function ScenarioComparisonTable({ table }: ScenarioComparisonTableProps) {
  const columns = useMemo<ColumnDef<ScenarioRow, unknown>[]>(
    () => [
      {
        id: "scenario",
        header: table.columns[0],
        accessorKey: "scenario",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className={styles.scenarioCell}>
              <IconTile tone={r.tone} size="sm">
                <span className={styles.dot} aria-hidden />
              </IconTile>
              <div className={styles.scenarioText}>
                <span className={styles.scenarioName}>{r.scenario}</span>
                <span className={styles.scenarioDesc}>{r.description}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: "conversionProbability",
        header: table.columns[1],
        accessorKey: "conversionProbability",
        cell: ({ row }) => (
          <ValueCell
            value={row.original.conversionProbability}
            delta={row.original.conversionDelta}
          />
        ),
      },
      {
        id: "revenue",
        header: table.columns[2],
        accessorKey: "revenue",
        cell: ({ row }) => (
          <ValueCell value={row.original.revenue} delta={row.original.revenueDelta} />
        ),
      },
      {
        id: "investment",
        header: table.columns[3],
        accessorKey: "investment",
        cell: ({ row }) => (
          <ValueCell
            value={row.original.investment}
            delta={row.original.investmentDelta}
          />
        ),
      },
      {
        id: "roas",
        header: table.columns[4],
        accessorKey: "roas",
        cell: ({ row }) => (
          <ValueCell value={row.original.roas} delta={row.original.roasDelta} />
        ),
      },
      {
        id: "impact",
        header: table.columns[5],
        accessorKey: "impact",
        cell: ({ row }) => (
          <ValueCell value={row.original.impact} delta={row.original.impactDelta} />
        ),
      },
      {
        id: "actions",
        header: table.columns[6],
        cell: ({ row }) => (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="icon"
                size="sm"
                aria-label={`Ações para ${row.original.scenario}`}
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
                  Duplicar cenário
                </DropdownMenu.Item>
                <DropdownMenu.Item className={styles.menuItem}>
                  Excluir
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        ),
      },
    ],
    [table.columns],
  );

  return (
    <Card>
      <Card.Header>
        <Card.Title>{table.title}</Card.Title>
      </Card.Header>
      <Card.Body>
        <DataTable<ScenarioRow>
          columns={columns}
          data={table.rows}
          pageSize={10}
          getRowId={(row) => row.scenario}
        />
      </Card.Body>
      <Card.Footer>
        <a href="#all-scenarios" className={styles.allLink}>
          {table.action}
        </a>
      </Card.Footer>
    </Card>
  );
}
