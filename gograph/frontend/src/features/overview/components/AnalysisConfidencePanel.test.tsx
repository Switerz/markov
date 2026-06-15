import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalysisConfidencePanel } from "./AnalysisConfidencePanel";
import { overviewMock } from "../overview.mock";

describe("AnalysisConfidencePanel", () => {
  it("renders one progress bar per confidence item (6 total)", () => {
    const { container } = render(
      <AnalysisConfidencePanel
        confidence={overviewMock.analysisConfidence}
      />,
    );
    const bars = container.querySelectorAll('[role="progressbar"]');
    expect(bars.length).toBe(6);
  });

  it("renders the calibration and data quality labels", () => {
    render(
      <AnalysisConfidencePanel
        confidence={overviewMock.analysisConfidence}
      />,
    );
    expect(screen.getByText("Markov (Ordem 10)")).toBeInTheDocument();
    expect(screen.getByText("Cobertura de eventos")).toBeInTheDocument();
  });

  it("renders the summary callout", () => {
    render(
      <AnalysisConfidencePanel
        confidence={overviewMock.analysisConfidence}
      />,
    );
    expect(screen.getByText(/confiança geral: alta/i)).toBeInTheDocument();
  });
});
