import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./DataTable";

type Row = { id: string; name: string; channel: string };

const rows: Row[] = [
  { id: "1", name: "Google Ads", channel: "google_ads" },
  { id: "2", name: "Meta Ads", channel: "meta_ads" },
  { id: "3", name: "Direct", channel: "direct" },
];

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "name", header: "Nome" },
  { accessorKey: "channel", header: "Canal" },
];

describe("DataTable", () => {
  it("renders rows", () => {
    render(<DataTable columns={columns} data={rows} getRowId={(r) => r.id} />);
    expect(screen.getByText("Google Ads")).toBeInTheDocument();
    expect(screen.getByText("Meta Ads")).toBeInTheDocument();
    expect(screen.getByText("Direct")).toBeInTheDocument();
  });

  it("calls onRowClick when row clicked", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getByText("Meta Ads"));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0][0]).toEqual(rows[1]);
  });

  it("filters via search input", () => {
    render(
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Buscar..."
        getRowId={(r) => r.id}
      />,
    );
    const input = screen.getByPlaceholderText("Buscar...");
    fireEvent.change(input, { target: { value: "Meta" } });
    expect(screen.getByText("Meta Ads")).toBeInTheDocument();
    expect(screen.queryByText("Google Ads")).not.toBeInTheDocument();
  });

  it("highlights selected row via data-selected", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        selectedRowId="2"
      />,
    );
    const selected = container.querySelector('tr[data-selected="true"]');
    expect(selected).not.toBeNull();
    expect(selected?.textContent).toContain("Meta Ads");
  });
});
