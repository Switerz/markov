import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "../../shared/ui";

// xyflow does not render under jsdom; mock the graph panel so the page test
// can mount the default tab safely.
vi.mock("./components/JourneyGraphPanel", () => ({
  JourneyGraphPanel: () => <div data-testid="graph-panel">graph-panel</div>,
}));

import { JourneysPage } from "./JourneysPage";

const renderPage = () =>
  render(
    <MemoryRouter>
      <TooltipProvider>
        <JourneysPage />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe("JourneysPage", () => {
  it("renders title and subtitle", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: /jornadas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Explore e compreenda os caminhos que levam seus usuários/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders 4 view tab triggers", () => {
    renderPage();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(screen.getByRole("tab", { name: /Fluxo/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Grafo/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Caminhos/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Matriz/i })).toBeInTheDocument();
  });

  it("default tab 'flow' shows Sankey and Builder", () => {
    renderPage();
    expect(screen.getByText("Fluxo de jornadas")).toBeInTheDocument();
    expect(screen.getByText("Construir jornada")).toBeInTheDocument();
  });

  it("renders bottom row: Top paths, Matrix and Loops", () => {
    renderPage();
    // Top paths and Matrix appear twice (in the tab content + bottom row),
    // so we assert getAllByText returns at least one match.
    expect(screen.getAllByText("Top caminhos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Matriz de transição").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Loops e padrões")).toBeInTheDocument();
  });
});
