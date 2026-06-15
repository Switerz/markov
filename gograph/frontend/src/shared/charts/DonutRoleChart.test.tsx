import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 280 }}>{children}</div>
    ),
  };
});

import { DonutRoleChart, type DonutSegment } from "./DonutRoleChart";

const segments: DonutSegment[] = [
  { label: "Initiator", description: "Top of funnel", value: 30, tone: "blue" },
  { label: "Assister", description: "Mid funnel", value: 50, tone: "indigo" },
  { label: "Closer", description: "Last touch", value: 20, tone: "green" },
];

describe("DonutRoleChart", () => {
  it("renders all legend items with descriptions", () => {
    render(<DonutRoleChart segments={segments} centerLabel="100%" />);
    expect(screen.getByText("Initiator")).toBeInTheDocument();
    expect(screen.getByText("Assister")).toBeInTheDocument();
    expect(screen.getByText("Closer")).toBeInTheDocument();
    expect(screen.getByText("Top of funnel")).toBeInTheDocument();
    expect(screen.getByText("30.0%")).toBeInTheDocument();
    expect(screen.getByText("50.0%")).toBeInTheDocument();
    expect(screen.getByText("20.0%")).toBeInTheDocument();
  });

  it("renders accessible legend list", () => {
    render(<DonutRoleChart segments={segments} />);
    expect(screen.getByRole("list", { name: /legenda/i })).toBeInTheDocument();
  });
});
