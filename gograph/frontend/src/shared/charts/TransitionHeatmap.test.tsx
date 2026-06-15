import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransitionHeatmap, type HeatmapRow } from "./TransitionHeatmap";

const columns = ["Meta", "Google", "Direct"];
const rows: HeatmapRow[] = [
  { from: "Meta", values: [null, 0.4, 0.1] },
  { from: "Google", values: [0.3, null, 0.2] },
  { from: "Direct", values: [0.05, 0.05, null] },
];

describe("TransitionHeatmap", () => {
  it("renders correct number of header cells (incl. corner) and rows", () => {
    const { container } = render(
      <TransitionHeatmap columns={columns} rows={rows} metricLabel="Prob." />,
    );
    const headers = container.querySelectorAll("thead th");
    expect(headers).toHaveLength(columns.length + 1);
    const bodyRows = container.querySelectorAll("tbody tr");
    expect(bodyRows).toHaveLength(rows.length);
  });

  it("renders row labels and cell values", () => {
    render(<TransitionHeatmap columns={columns} rows={rows} />);
    // Each label appears twice: once as column header, once as row header.
    expect(screen.getAllByText("Meta")).toHaveLength(2);
    expect(screen.getAllByText("Google")).toHaveLength(2);
    expect(screen.getAllByText("Direct")).toHaveLength(2);
    expect(screen.getByText("40.0%")).toBeInTheDocument();
    expect(screen.getByText("30.0%")).toBeInTheDocument();
  });
});
