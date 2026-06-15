import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScenarioInsightsPanel } from "./ScenarioInsightsPanel";
import { experimentsMock } from "../experiments.mock";

describe("ScenarioInsightsPanel", () => {
  it("renders 3 main learnings and primary action", () => {
    render(<ScenarioInsightsPanel insights={experimentsMock.scenarioInsights} />);
    experimentsMock.scenarioInsights.mainLearnings.forEach((l) => {
      expect(screen.getByText(l)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /Criar plano de teste incremental/i }),
    ).toBeInTheDocument();
  });
});
