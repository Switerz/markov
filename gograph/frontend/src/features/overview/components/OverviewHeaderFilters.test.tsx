import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OverviewHeaderFilters } from "./OverviewHeaderFilters";
import type { FilterItem } from "../types";

const filters: FilterItem[] = [
  { id: "account", type: "select", icon: "Building2", value: "GoCase" },
  {
    id: "period",
    type: "dateRange",
    icon: "Calendar",
    value: "01 Mai — 31 Mai 2026",
  },
  {
    id: "compareWith",
    type: "dateRange",
    label: "Comparar com:",
    value: "01 Abr — 30 Abr 2026",
  },
  {
    id: "execution",
    type: "select",
    icon: "Play",
    value: "Execução: v2026.05.31.01",
  },
  {
    id: "confidence",
    type: "status",
    icon: "Circle",
    label: "Confiança:",
    value: "Alta",
    tone: "green",
  },
];

const values = {
  account: "GoCase",
  period: { from: null, to: null },
  compareWith: { from: null, to: null },
  executionId: null,
};

describe("OverviewHeaderFilters", () => {
  it("renders one chip per filter with its value visible", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <OverviewHeaderFilters
          filters={filters}
          values={values}
          onChange={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText("GoCase")).toBeInTheDocument();
    expect(screen.getByText("01 Mai — 31 Mai 2026")).toBeInTheDocument();
    expect(screen.getByText("Comparar com:")).toBeInTheDocument();
    expect(screen.getByText("01 Abr — 30 Abr 2026")).toBeInTheDocument();
    expect(screen.getByText("Execução: v2026.05.31.01")).toBeInTheDocument();
    expect(screen.getByText("Confiança:")).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
  });
});
