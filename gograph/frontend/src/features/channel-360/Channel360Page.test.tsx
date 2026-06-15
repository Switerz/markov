import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Providers } from "../../app/Providers";
import { Channel360Page } from "./Channel360Page";

const renderPage = () =>
  render(
    <MemoryRouter
      initialEntries={["/decisoes-de-budget/canais/google-ads"]}
    >
      <Providers>
        <Routes>
          <Route
            path="/decisoes-de-budget/canais/:slug"
            element={<Channel360Page />}
          />
        </Routes>
      </Providers>
    </MemoryRouter>,
  );

describe("Channel360Page", () => {
  it("renders the channel name", () => {
    renderPage();
    expect(screen.getAllByText("Google Ads").length).toBeGreaterThan(0);
  });

  it("renders the recommendation badge", () => {
    renderPage();
    expect(
      screen.getAllByText("Scale Up — Strong Consensus").length,
    ).toBeGreaterThan(0);
  });

  it("renders the 5 metric strip titles", () => {
    renderPage();
    [
      "Investimento",
      "Receita atribuída",
      "ROAS (consenso)",
      "Presença em jornadas convertidas",
      "Papel predominante",
    ].forEach((t) => {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    });
  });

  it("renders the evidence section header", () => {
    renderPage();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: /Por que aumentar o investimento/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders the 2 relevant sequence rows", () => {
    renderPage();
    // The "Sequências relevantes" card title appears once; the per-row
    // uplift Badges appear twice (one per sequence).
    expect(screen.getByText("Sequências relevantes")).toBeInTheDocument();
    expect(screen.getByText("+38%")).toBeInTheDocument();
    expect(screen.getByText("+24%")).toBeInTheDocument();
  });

  it("renders the 6 quick detail labels", () => {
    renderPage();
    [
      "Tipo",
      "Objetivo principal",
      "Modelagem",
      "Janela de atribuição",
      "Cobertura de dados",
      "Última atualização",
    ].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});
