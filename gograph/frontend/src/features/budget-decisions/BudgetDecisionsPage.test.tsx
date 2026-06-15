import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "../../shared/ui";
import { BudgetDecisionsPage } from "./BudgetDecisionsPage";

const renderPage = () =>
  render(
    <MemoryRouter>
      <TooltipProvider>
        <BudgetDecisionsPage />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe("BudgetDecisionsPage", () => {
  it("renders the screen title", () => {
    renderPage();
    // The H1 lives in the TopBar, which Radix Dialog marks as aria-hidden
    // when the drawer is open — so we query by text rather than role.
    expect(screen.getByText("Decisões de Budget")).toBeInTheDocument();
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

  it("opens the drawer pre-selected on Google Ads with key sections visible", () => {
    renderPage();
    const drawer = screen.getByRole("dialog");
    expect(
      within(drawer).getByRole("heading", { level: 2, name: "Google Ads" }),
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
    // Click the Meta Ads row in the table.
    const metaCell = screen.getAllByText("Meta Ads")[0];
    fireEvent.click(metaCell);
    expect(
      screen.getByRole("heading", { level: 2, name: "Meta Ads" }),
    ).toBeInTheDocument();
  });

  it("Ver canal 360 link uses the slugified channel name", () => {
    renderPage();
    const drawer = screen.getByRole("dialog");
    const link = within(drawer).getByRole("link", {
      name: /Ver canal 360/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "/decisoes-de-budget/canais/google-ads",
    );
  });
});
