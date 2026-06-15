import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCardGrid } from "./MetricCardGrid";
import { overviewMock } from "../overview.mock";

describe("MetricCardGrid", () => {
  it("renders the 6 metrics from the contract", () => {
    render(<MetricCardGrid metrics={overviewMock.metrics} />);
    [
      "Receita analisada",
      "Investimento em mídia",
      "ROAS atribuído",
      "Taxa de conversão",
      "Oportunidades de escala",
      "Budget mal alocado",
    ].forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
  });
});
