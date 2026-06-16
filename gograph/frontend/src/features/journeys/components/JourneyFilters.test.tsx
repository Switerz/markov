import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { JourneyFilters } from "./JourneyFilters";
import { journeysMock } from "../journeys.mock";
import { DEFAULT_JOURNEY_FILTERS } from "../hooks/useJourneysData";

describe("JourneyFilters", () => {
  it("renders all filters from the mock", () => {
    render(
      <JourneyFilters
        filters={journeysMock.filters}
        state={DEFAULT_JOURNEY_FILTERS}
        onChange={vi.fn()}
        channelOptions={journeysMock.journeyFlow.middleNodes.map(
          (node) => node.channel,
        )}
      />,
    );
    // 5 selects/dateRange + 2 switches = 7 controls; we verify the switches by
    // label and that at least one select trigger exists.
    expect(screen.getByText("Ocultar diretos")).toBeInTheDocument();
    expect(screen.getByText("Ocultar self-loops")).toBeInTheDocument();
    // DateRangePicker trigger uses its label as aria-label.
    expect(
      screen.getByLabelText("01 Mai — 31 Mai 2026"),
    ).toBeInTheDocument();
    // 5 select/date filters: each has a trigger; verify there are several
    // present via roles. (3 select chips render as combobox triggers.)
    expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(3);
  });
});
