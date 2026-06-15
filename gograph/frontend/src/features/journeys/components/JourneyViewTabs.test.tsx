import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "../../../shared/ui";
import { JourneyViewTabs } from "./JourneyViewTabs";
import { journeysMock } from "../journeys.mock";

describe("JourneyViewTabs", () => {
  it("renders 4 triggers and fires change on click", () => {
    const onChange = vi.fn();
    render(
      <Tabs.Root defaultValue="flow" onValueChange={onChange}>
        <JourneyViewTabs tabs={journeysMock.viewTabs} />
      </Tabs.Root>,
    );
    const triggers = screen.getAllByRole("tab");
    expect(triggers).toHaveLength(4);
    const paths = screen.getByRole("tab", { name: /Caminhos/i });
    fireEvent.mouseDown(paths, { button: 0 });
    fireEvent.click(paths);
    expect(onChange).toHaveBeenCalledWith("paths");
  });
});
