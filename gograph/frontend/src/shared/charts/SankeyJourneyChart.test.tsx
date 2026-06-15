import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@nivo/sankey", () => ({
  ResponsiveSankey: ({ data }: { data: { nodes: { id: string }[] } }) => (
    <div data-testid="nivo-sankey">
      {data.nodes.map((n) => (
        <span key={n.id} data-testid="sankey-node">
          {n.id}
        </span>
      ))}
    </div>
  ),
}));

import {
  SankeyJourneyChart,
  type SankeyNode,
  type SankeyLink,
} from "./SankeyJourneyChart";

const nodes: SankeyNode[] = [
  { id: "Meta", tone: "blue" },
  { id: "Google", tone: "green" },
  { id: "Compra", tone: "indigo" },
];

const links: SankeyLink[] = [
  { source: "Meta", target: "Compra", value: 10 },
  { source: "Google", target: "Compra", value: 20 },
];

describe("SankeyJourneyChart", () => {
  it("mounts and renders root wrapper with metric label", () => {
    render(
      <SankeyJourneyChart
        nodes={nodes}
        links={links}
        metricLabel="Receita"
      />,
    );
    expect(screen.getByTestId("sankey-root")).toBeInTheDocument();
    expect(screen.getByText("Receita")).toBeInTheDocument();
    expect(screen.getByTestId("nivo-sankey")).toBeInTheDocument();
    expect(screen.getAllByTestId("sankey-node")).toHaveLength(3);
  });
});
