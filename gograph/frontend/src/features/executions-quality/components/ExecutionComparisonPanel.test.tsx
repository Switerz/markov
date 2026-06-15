import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExecutionComparisonPanel } from "./ExecutionComparisonPanel";
import { executionsQualityMock } from "../executions-quality.mock";

describe("ExecutionComparisonPanel", () => {
  it("renders all 6 channel-change rows", () => {
    render(<ExecutionComparisonPanel compare={executionsQualityMock.compareExecutions} />);
    [
      "Google Ads",
      "Meta Ads",
      "WhatsApp CRM",
      "Email",
      "Display",
      "Outros",
    ].forEach((channel) => {
      expect(screen.getByText(channel)).toBeInTheDocument();
    });
  });

  it("renders the variation row and the legend labels", () => {
    render(<ExecutionComparisonPanel compare={executionsQualityMock.compareExecutions} />);
    expect(screen.getByText("Variação de receita total")).toBeInTheDocument();
    expect(screen.getByText("+ R$ 2,7M")).toBeInTheDocument();
    expect(screen.getByText("Aumentou")).toBeInTheDocument();
    expect(screen.getByText("Diminuiu")).toBeInTheDocument();
    expect(screen.getByText("Estável")).toBeInTheDocument();
  });
});
