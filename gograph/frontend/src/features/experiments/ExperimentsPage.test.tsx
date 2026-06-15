import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "../../app/Providers";
import { ExperimentsPage } from "./ExperimentsPage";

const renderPage = () =>
  render(
    <MemoryRouter>
      <Providers>
        <ExperimentsPage />
      </Providers>
    </MemoryRouter>,
  );

describe("ExperimentsPage", () => {
  it("renders the screen title and subtitle", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: /Experimentos/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Simule cenários, compare impactos/i),
    ).toBeInTheDocument();
  });

  it("renders the 4 action-type pills", () => {
    renderPage();
    ["Remover canal", "Reduzir presença", "Redistribuir budget", "Comparar modelos"].forEach(
      (label) => {
        expect(
          screen.getByRole("radio", { name: new RegExp(label, "i") }),
        ).toBeInTheDocument();
      },
    );
  });

  it("renders the 3 comparison columns", () => {
    renderPage();
    expect(screen.getAllByText(/Baseline \(atual\)/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cenário: Sem Display/i)).toBeInTheDocument();
    expect(screen.getByText(/Delta \(Cenário vs Baseline\)/i)).toBeInTheDocument();
  });

  it("renders the 4 scenarios in the comparison table", () => {
    renderPage();
    expect(
      screen.getAllByRole("button", { name: /Ações para/i }),
    ).toHaveLength(4);
  });

  it("renders the 3 main learnings in the insights panel", () => {
    renderPage();
    expect(
      screen.getByText(/A remoção de Display reduz a receita atribuída em 10,9%/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Meta Ads e Google Ads compensam 63% da perda de receita/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ROAS melhora \+0,29x, indicando maior eficiência/i),
    ).toBeInTheDocument();
  });

  it("renders the primary insights action", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /Criar plano de teste incremental/i }),
    ).toBeInTheDocument();
  });
});
