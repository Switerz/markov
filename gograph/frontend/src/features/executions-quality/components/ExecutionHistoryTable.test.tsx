import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "../../../shared/ui";
import { ExecutionHistoryTable } from "./ExecutionHistoryTable";
import { executionsQualityMock } from "../executions-quality.mock";

const history = executionsQualityMock.executionHistory;

const renderTable = (selectedId?: string, onSelect: (id: string) => void = () => {}) =>
  render(
    <TooltipProvider>
      <ExecutionHistoryTable
        history={history}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </TooltipProvider>,
  );

describe("ExecutionHistoryTable", () => {
  it("renders the 5 history rows", () => {
    renderTable();
    expect(screen.getByText("01 Abr — 30 Abr 2026")).toBeInTheDocument();
    expect(screen.getByText("01 Mar — 31 Mar 2026")).toBeInTheDocument();
    expect(screen.getByText("01 Fev — 28 Fev 2026")).toBeInTheDocument();
    expect(screen.getByText("01 Jan — 31 Jan 2026")).toBeInTheDocument();
    expect(screen.getByText("01 Dez 2025 — 31 Dez 2025")).toBeInTheDocument();
  });

  it("calls onSelect with the row id when a row is clicked", () => {
    const onSelect = vi.fn();
    renderTable(undefined, onSelect);
    const row = screen.getByText("01 Mar — 31 Mar 2026").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(row as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith("01 Mar — 31 Mar 2026");
  });
});
