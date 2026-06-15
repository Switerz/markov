import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExecutionSummaryCards } from "./ExecutionSummaryCards";
import { executionsQualityMock } from "../executions-quality.mock";

describe("ExecutionSummaryCards", () => {
  it("renders all 4 summary metric titles", () => {
    render(<ExecutionSummaryCards metrics={executionsQualityMock.summaryMetrics} />);
    expect(screen.getByText("Total de execuções")).toBeInTheDocument();
    expect(screen.getByText("Confiança da última execução")).toBeInTheDocument();
    expect(screen.getByText("Runtime médio")).toBeInTheDocument();
    expect(screen.getByText("Alertas críticos")).toBeInTheDocument();
  });
});
