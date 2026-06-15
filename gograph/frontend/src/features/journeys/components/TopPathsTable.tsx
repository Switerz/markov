import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Card, DataTable, StatDelta, Button } from "../../../shared/ui";
import {
  channelIcon,
  channelInitial,
} from "../../../shared/icons/channelIcons";
import type { TopPaths, TopPathRow } from "../types";
import styles from "./TopPathsTable.module.css";

export type TopPathsTableProps = {
  paths: TopPaths;
};

function deltaTone(delta: string): "positive" | "negative" | "neutral" {
  if (delta.trim().startsWith("+")) return "positive";
  if (delta.trim().startsWith("-")) return "negative";
  return "neutral";
}

function PathChips({ path }: { path: string }) {
  const steps = path.split(/\s*>\s*/);
  return (
    <span className={styles.pathCell}>
      {steps.map((step, idx) => {
        const icon = channelIcon(step, 12);
        return (
          <span key={`${step}-${idx}`} className={styles.pathCell}>
            <span className={styles.chip}>
              {icon ?? (
                <span aria-hidden style={{ fontWeight: 600 }}>
                  {channelInitial(step)}
                </span>
              )}
              {step}
            </span>
            {idx < steps.length - 1 && (
              <ChevronRight
                size={12}
                aria-hidden
                className={styles.separator}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

export function TopPathsTable({ paths }: TopPathsTableProps) {
  const columns = useMemo<ColumnDef<TopPathRow, unknown>[]>(
    () => [
      {
        id: "rank",
        header: "#",
        cell: ({ row }) => (
          <span className={styles.rank}>{row.original.rank}</span>
        ),
      },
      {
        id: "path",
        header: "Caminho",
        cell: ({ row }) => <PathChips path={row.original.path} />,
      },
      {
        id: "participation",
        header: "Participação",
        cell: ({ row }) => (
          <div className={styles.participation}>
            <span>{row.original.participation}</span>
            <StatDelta
              value={row.original.delta}
              tone={deltaTone(row.original.delta)}
            />
          </div>
        ),
      },
      {
        id: "revenue",
        header: "Receita atribuída",
        cell: ({ row }) => row.original.revenue,
      },
      {
        id: "conversions",
        header: "Conversões",
        cell: ({ row }) => row.original.conversions,
      },
      {
        id: "ticket",
        header: "Ticket médio",
        cell: ({ row }) => row.original.ticket,
      },
      {
        id: "timeToConversion",
        header: "Tempo até conversão",
        cell: ({ row }) => row.original.timeToConversion,
      },
    ],
    [],
  );

  return (
    <Card>
      <Card.Header>
        <Card.Title>{paths.title}</Card.Title>
      </Card.Header>
      <Card.Body>
        <DataTable<TopPathRow>
          columns={columns}
          data={paths.rows}
          pageSize={5}
        />
      </Card.Body>
      <Card.Footer>
        <div className={styles.footerAction}>
          <Button variant="ghost" size="sm">
            {paths.action}
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
}
