import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { JourneySummaryPanel } from "./JourneySummaryPanel";
import { overviewMock } from "../overview.mock";

describe("JourneySummaryPanel", () => {
  it("renders the four column titles", () => {
    render(<JourneySummaryPanel journey={overviewMock.journeySummary} />);
    expect(screen.getByText("Top canais de entrada")).toBeInTheDocument();
    expect(screen.getByText("Top canais de meio")).toBeInTheDocument();
    expect(screen.getByText("Top canais de assistência")).toBeInTheDocument();
    expect(screen.getByText("Top canais de fim")).toBeInTheDocument();
  });

  it("renders the top channels with their percentage values", () => {
    render(<JourneySummaryPanel journey={overviewMock.journeySummary} />);
    // "38%" appears at least twice (entry Google Ads + assist Outros), but
    // also as a value cell — just assert presence anywhere.
    expect(screen.getAllByText("38%").length).toBeGreaterThan(0);
    // Channel names show up in multiple columns; use getAllByText.
    expect(screen.getAllByText(/Google Ads/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/WhatsApp CRM/).length).toBeGreaterThan(0);
  });
});
