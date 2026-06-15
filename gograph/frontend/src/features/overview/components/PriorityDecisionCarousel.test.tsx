import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriorityDecisionCarousel } from "./PriorityDecisionCarousel";
import { overviewMock } from "../overview.mock";

describe("PriorityDecisionCarousel", () => {
  it("renders one card per priority decision", () => {
    render(
      <PriorityDecisionCarousel decisions={overviewMock.priorityDecisions} />,
    );
    ["Google Ads", "Meta Ads", "WhatsApp CRM", "Email", "Display"].forEach(
      (c) => expect(screen.getByText(c)).toBeInTheDocument(),
    );
  });

  it("shows the recommendation badges", () => {
    render(
      <PriorityDecisionCarousel decisions={overviewMock.priorityDecisions} />,
    );
    expect(screen.getAllByText("Escalar").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Defender")).toBeInTheDocument();
    expect(screen.getByText("Investigar")).toBeInTheDocument();
    expect(screen.getByText("Reduzir")).toBeInTheDocument();
  });
});
