import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecommendationSummaryCards } from "./RecommendationSummaryCards";
import { budgetDecisionsMock } from "../budget-decisions.mock";

describe("RecommendationSummaryCards", () => {
  it("renders one card per summary entry", () => {
    render(
      <RecommendationSummaryCards cards={budgetDecisionsMock.summaryCards} />,
    );
    ["Escalar", "Defender", "Investigar", "Reduzir"].forEach((title) => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });
});
