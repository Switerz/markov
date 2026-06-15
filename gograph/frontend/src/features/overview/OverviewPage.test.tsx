import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "../../app/Providers";
import { OverviewPage } from "./OverviewPage";

const renderPage = () =>
  render(
    <Providers>
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>
    </Providers>,
  );

describe("OverviewPage", () => {
  it("renders title", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: /visão geral/i }),
    ).toBeInTheDocument();
  });

  it("renders all 6 metrics", () => {
    renderPage();
    [
      "Receita analisada",
      "Investimento em mídia",
      "ROAS atribuído",
      "Taxa de conversão",
      "Oportunidades de escala",
      "Budget mal alocado",
    ].forEach((m) => expect(screen.getByText(m)).toBeInTheDocument());
  });

  it("renders priority decisions for known channels", () => {
    renderPage();
    ["Google Ads", "Meta Ads", "WhatsApp CRM", "Email", "Display"].forEach(
      (c) => expect(screen.getAllByText(c).length).toBeGreaterThan(0),
    );
  });

  it("renders consensus matrix axes", () => {
    renderPage();
    expect(screen.getAllByText(/markov/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/shapley/i).length).toBeGreaterThan(0);
  });

  it("renders journey summary stages", () => {
    renderPage();
    ["Entrada", "Assistidos", "Engajados", "Leads", "Conversões"].forEach(
      (s) => expect(screen.getAllByText(s).length).toBeGreaterThan(0),
    );
  });

  it("renders confidence summary label", () => {
    renderPage();
    expect(screen.getByText(/confiança geral: alta/i)).toBeInTheDocument();
  });

  it("clicking Nova execução opens the NewRunDialog modal", () => {
    renderPage();
    expect(
      screen.queryByRole("dialog", { name: /Nova execução/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Nova execução/i }));
    expect(
      screen.getByRole("dialog", { name: /Nova execução/i }),
    ).toBeInTheDocument();
  });
});
