import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BaselineScenarioComparison } from "./BaselineScenarioComparison";
import { experimentsMock } from "../experiments.mock";

describe("BaselineScenarioComparison", () => {
  it("renders 3 columns with 5 metric rows each", () => {
    const view = render(
      <BaselineScenarioComparison data={experimentsMock.baselineVsScenario} />,
    );
    expect(
      screen.getByText(/Baseline \(atual\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cenário: Sem Display/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Delta \(Cenário vs Baseline\)/i),
    ).toBeInTheDocument();

    // 3 columns × 5 rows = 15 metric rows total
    expect(view.container.querySelectorAll("[data-tone]").length).toBeGreaterThanOrEqual(3);
    expect(
      screen.getAllByText(/Probabilidade de conversão/i),
    ).toHaveLength(3);
    expect(screen.getAllByText(/Receita atribuída/i)).toHaveLength(3);
    expect(screen.getAllByText(/Investimento total/i)).toHaveLength(3);
    expect(screen.getAllByText(/ROAS atribuído/i)).toHaveLength(3);
    expect(screen.getAllByText(/Impacto estimado/i)).toHaveLength(3);
  });
});
