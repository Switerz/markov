import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScenarioComparisonTable } from "./ScenarioComparisonTable";
import { experimentsMock } from "../experiments.mock";

describe("ScenarioComparisonTable", () => {
  it("renders 4 rows (baseline + 3 scenarios)", () => {
    render(
      <ScenarioComparisonTable
        table={experimentsMock.scenarioComparisonTable}
      />,
    );
    expect(screen.getByText(/Baseline \(atual\)/i)).toBeInTheDocument();
    expect(screen.getByText("Sem Display")).toBeInTheDocument();
    expect(screen.getByText("Sem Influencers")).toBeInTheDocument();
    expect(screen.getByText(/Menos 10% Meta Ads/i)).toBeInTheDocument();
    // One actions menu per row
    expect(
      screen.getAllByRole("button", { name: /Ações para/i }),
    ).toHaveLength(4);
    expect(
      screen.getByRole("link", { name: /Ver todos os cenários \(7\)/i }),
    ).toBeInTheDocument();
  });
});
