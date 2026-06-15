import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExecutionDetailsPanel } from "./ExecutionDetailsPanel";
import { executionsQualityMock } from "../executions-quality.mock";

const panel = executionsQualityMock.executionDetailsPanel;

describe("ExecutionDetailsPanel", () => {
  it("renders the 4 tab triggers", () => {
    render(<ExecutionDetailsPanel panel={panel} />);
    ["Parâmetros", "Entradas", "Saídas", "Logs"].forEach((label) => {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    });
  });

  it("renders all 9 model-parameter labels", () => {
    render(<ExecutionDetailsPanel panel={panel} />);
    expect(screen.getAllByRole("term")).toHaveLength(9);
    panel.modelParameters.forEach((p) => {
      expect(screen.getByText(p.label)).toBeInTheDocument();
      expect(screen.getByText(p.value)).toBeInTheDocument();
    });
  });

  it("exposes a Fechar painel and a Mais ações button", () => {
    render(<ExecutionDetailsPanel panel={panel} />);
    expect(screen.getByRole("button", { name: "Fechar painel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais ações" })).toBeInTheDocument();
  });
});
