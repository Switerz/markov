import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "../../../shared/ui";
import { ChannelDetailsDrawer } from "./ChannelDetailsDrawer";
import { budgetDecisionsMock } from "../budget-decisions.mock";

const renderDrawer = () =>
  render(
    <MemoryRouter>
      <TooltipProvider>
        <ChannelDetailsDrawer
          open
          onOpenChange={() => {}}
          drawer={budgetDecisionsMock.selectedChannelDrawer}
        />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe("ChannelDetailsDrawer", () => {
  it("renders the channel header with recommendation", () => {
    renderDrawer();
    expect(
      screen.getByRole("heading", { level: 2, name: "Google Ads" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Escalar").length).toBeGreaterThan(0);
  });

  it("renders the Resumo content by default", () => {
    renderDrawer();
    expect(screen.getByText("Recomendação")).toBeInTheDocument();
    expect(screen.getByText(/Por que essa recomendação/i)).toBeInTheDocument();
  });

  it("switches to the Cenários tab on click", () => {
    renderDrawer();
    const trigger = screen.getByRole("tab", { name: /Cenários/i });
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.click(trigger);
    expect(screen.getByText(/em construção/i)).toBeInTheDocument();
  });

  it("Ver canal 360 link uses the slugified channel name", () => {
    renderDrawer();
    const link = screen.getByRole("link", { name: /Ver canal 360/i });
    expect(link).toHaveAttribute(
      "href",
      "/decisoes-de-budget/canais/google-ads",
    );
  });
});
