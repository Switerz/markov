import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "../../app/Providers";
import { ExecutionsQualityPage } from "./ExecutionsQualityPage";

const renderPage = () =>
  render(
    <MemoryRouter>
      <Providers>
        <ExecutionsQualityPage />
      </Providers>
    </MemoryRouter>,
  );

describe("ExecutionsQualityPage", () => {
  it("renders the title and subtitle", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: /Execuções & Qualidade/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Gerencie execuções do modelo e garanta confiança/i),
    ).toBeInTheDocument();
  });

  it("renders the 4 summary cards", () => {
    renderPage();
    expect(screen.getByText("Total de execuções")).toBeInTheDocument();
    expect(screen.getByText("Confiança da última execução")).toBeInTheDocument();
    expect(screen.getByText("Runtime médio")).toBeInTheDocument();
    expect(screen.getByText("Alertas críticos")).toBeInTheDocument();
  });

  it("renders the 5 execution history rows", () => {
    renderPage();
    [
      "01 Abr — 30 Abr 2026",
      "01 Mar — 31 Mar 2026",
      "01 Fev — 28 Fev 2026",
      "01 Jan — 31 Jan 2026",
      "01 Dez 2025 — 31 Dez 2025",
    ].forEach((period) => {
      expect(screen.getAllByText(period).length).toBeGreaterThan(0);
    });
  });

  it("marks the default-selected row (01 Abr — 30 Abr 2026)", () => {
    renderPage();
    const selectedRows = document.querySelectorAll('tr[data-selected="true"]');
    expect(selectedRows).toHaveLength(1);
    expect(within(selectedRows[0] as HTMLElement).getByText("01 Abr — 30 Abr 2026")).toBeInTheDocument();
  });

  it("renders the Trust Center sub-section titles", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 3, name: "Calibração do modelo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Qualidade dos dados" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Alertas críticos (2)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Checks de qualidade" }),
    ).toBeInTheDocument();
  });

  it("renders the 6 channel comparison rows", () => {
    renderPage();
    [
      "Google Ads",
      "Meta Ads",
      "WhatsApp CRM",
      "Email",
      "Display",
      "Outros",
    ].forEach((channel) => {
      expect(screen.getByText(channel)).toBeInTheDocument();
    });
  });

  it("renders the 4 detail-panel tabs and 9 parameter labels", () => {
    renderPage();
    ["Parâmetros", "Entradas", "Saídas", "Logs"].forEach((label) => {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    });
    const params = [
      "Lookback (janela de análise)",
      "Decaimento (lambda - half-life)",
      "Amostras Shapley",
      "Amostra não-conversão",
      "Janela de censura",
      "Granularidade",
      "Moeda",
      "Modelo de atribuição",
      "Versão do algoritmo",
    ];
    params.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});
