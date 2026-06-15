import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { JourneySummaryPanel } from "./JourneySummaryPanel";
import { overviewMock } from "../overview.mock";

describe("JourneySummaryPanel", () => {
  it("renders the three column titles", () => {
    render(<JourneySummaryPanel journey={overviewMock.journeySummary} />);
    expect(screen.getByText("Top canais de entrada")).toBeInTheDocument();
    expect(screen.getByText("Top assistentes")).toBeInTheDocument();
    expect(screen.getByText("Top canais de fechamento")).toBeInTheDocument();
  });

  it("renders the 5 flow stages", () => {
    render(<JourneySummaryPanel journey={overviewMock.journeySummary} />);
    ["Entrada", "Assistidos", "Engajados", "Leads", "Conversões"].forEach(
      (s) => expect(screen.getAllByText(s).length).toBeGreaterThan(0),
    );
  });

  it("shows average time to conversion", () => {
    render(<JourneySummaryPanel journey={overviewMock.journeySummary} />);
    expect(screen.getByText("6,2 dias")).toBeInTheDocument();
  });
});
