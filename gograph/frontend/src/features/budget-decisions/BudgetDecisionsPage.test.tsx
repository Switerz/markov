import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Providers } from "../../app/Providers";
import { BudgetDecisionsPage } from "./BudgetDecisionsPage";

const renderPage = () =>
  render(
    <MemoryRouter>
      <Providers>
        <BudgetDecisionsPage />
      </Providers>
    </MemoryRouter>,
  );

describe("BudgetDecisionsPage", () => {
  it("renders the screen title", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "Performance" }),
    ).toBeInTheDocument();
  });

  it("does not auto-open the drawer on mount", () => {
    renderPage();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the 4 recommendation summary cards", () => {
    renderPage();
    ["Escalar", "Defender", "Investigar", "Reduzir"].forEach((title) => {
      // Each card title is unique by role/heading.
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    });
  });

  it("renders the 7 channel rows in the table", () => {
    renderPage();
    [
      "Google Ads",
      "Meta Ads",
      "WhatsApp CRM",
      "Email",
      "Display",
      "Organic Search",
      "Direct",
    ].forEach((ch) => {
      expect(screen.getAllByText(ch).length).toBeGreaterThan(0);
    });
  });

  it("opens the drawer after clicking a row, with channel name in the header", () => {
    renderPage();
    // Click the Google Ads row in the table.
    const googleCell = screen.getAllByText("Google Ads")[0];
    fireEvent.click(googleCell);
    const drawer = screen.getByRole("dialog");
    // Title is rendered via Radix Dialog.Title (level 2 by default).
    expect(
      within(drawer).getByRole("heading", { level: 2, name: /Google Ads/i }),
    ).toBeInTheDocument();
    // "Recomendação" appears as both a column header and a drawer section
    // title; we scope the assertion to the drawer.
    expect(within(drawer).getByText("Recomendação")).toBeInTheDocument();
    expect(
      within(drawer).getByText(/Por que essa recomendação/i),
    ).toBeInTheDocument();
  });

  it("updates the drawer header when a different table row is clicked", () => {
    renderPage();
    fireEvent.click(screen.getAllByText("Google Ads")[0]);
    expect(
      screen.getByRole("heading", { level: 2, name: /Google Ads/i }),
    ).toBeInTheDocument();
    // Click the Meta Ads row in the table.
    const metaCell = screen.getAllByText("Meta Ads")[0];
    fireEvent.click(metaCell);
    expect(
      screen.getByRole("heading", { level: 2, name: /Meta Ads/i }),
    ).toBeInTheDocument();
  });

  it("Ver canal 360 link uses the slugified channel name", () => {
    renderPage();
    fireEvent.click(screen.getAllByText("Google Ads")[0]);
    const drawer = screen.getByRole("dialog");
    const link = within(drawer).getByRole("link", {
      name: /Ver canal 360/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "/performance/canais/google-ads",
    );
  });
});
