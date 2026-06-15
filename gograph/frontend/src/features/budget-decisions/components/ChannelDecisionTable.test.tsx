import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChannelDecisionTable } from "./ChannelDecisionTable";
import { budgetDecisionsMock } from "../budget-decisions.mock";

describe("ChannelDecisionTable", () => {
  it("renders all 7 channel rows", () => {
    render(
      <ChannelDecisionTable
        data={budgetDecisionsMock.channelsTable}
        onSelect={() => {}}
      />,
    );
    [
      "Google Ads",
      "Meta Ads",
      "WhatsApp CRM",
      "Email",
      "Display",
      "Organic Search",
      "Direct",
    ].forEach((ch) => expect(screen.getByText(ch)).toBeInTheDocument());
  });

  it("invokes onSelect with the channel when a row is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ChannelDecisionTable
        data={budgetDecisionsMock.channelsTable}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("Meta Ads"));
    expect(onSelect).toHaveBeenCalledWith("Meta Ads");
  });

  it("filters rows by the search input", () => {
    render(
      <ChannelDecisionTable
        data={budgetDecisionsMock.channelsTable}
        onSelect={() => {}}
      />,
    );
    const search = screen.getByPlaceholderText("Buscar canal");
    fireEvent.change(search, { target: { value: "Display" } });
    expect(screen.getByText("Display")).toBeInTheDocument();
    expect(screen.queryByText("Google Ads")).not.toBeInTheDocument();
  });
});
