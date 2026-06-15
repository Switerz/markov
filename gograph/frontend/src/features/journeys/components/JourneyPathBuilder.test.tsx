import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { JourneyPathBuilder } from "./JourneyPathBuilder";
import { Providers } from "../../../app/Providers";
import { journeysMock } from "../journeys.mock";

describe("JourneyPathBuilder", () => {
  it("renders the title, palette chips (at least 14), and custom input", () => {
    render(
      <Providers>
        <JourneyPathBuilder builder={journeysMock.journeyBuilder} />
      </Providers>,
    );
    expect(
      screen.getByText(journeysMock.journeyBuilder.title),
    ).toBeInTheDocument();
    const palette = screen.getByRole("toolbar", { name: /Paleta de canais/i });
    const chips = within(palette).getAllByRole("button");
    expect(chips.length).toBeGreaterThanOrEqual(14);
  });

  it("adds a node when a palette chip is clicked", () => {
    render(
      <Providers>
        <JourneyPathBuilder builder={journeysMock.journeyBuilder} />
      </Providers>,
    );
    const canvas = screen.getByTestId("journey-canvas");
    expect(canvas.querySelectorAll(".react-flow__node").length).toBe(0);

    const palette = screen.getByRole("toolbar", { name: /Paleta de canais/i });
    const googleAdsChip = within(palette).getByRole("button", {
      name: /Google Ads/i,
    });
    fireEvent.click(googleAdsChip);
    // After click, exactly 1 node should be present on the canvas.
    expect(canvas.querySelectorAll(".react-flow__node").length).toBe(1);
  });

  it("clears the canvas when the secondary action is clicked", () => {
    render(
      <Providers>
        <JourneyPathBuilder builder={journeysMock.journeyBuilder} />
      </Providers>,
    );
    const palette = screen.getByRole("toolbar", { name: /Paleta de canais/i });
    fireEvent.click(within(palette).getByRole("button", { name: /Email/i }));
    fireEvent.click(within(palette).getByRole("button", { name: /^SMS$/i }));
    const canvas = screen.getByTestId("journey-canvas");
    expect(canvas.querySelectorAll(".react-flow__node").length).toBe(2);

    const clearLabel = journeysMock.journeyBuilder.secondaryAction;
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(clearLabel, "i") }),
    );
    expect(canvas.querySelectorAll(".react-flow__node").length).toBe(0);
  });

  it("adds a hypothetical node from the custom input", () => {
    render(
      <Providers>
        <JourneyPathBuilder builder={journeysMock.journeyBuilder} />
      </Providers>,
    );
    const input = screen.getByLabelText(/Canal personalizado/i);
    fireEvent.change(input, { target: { value: "Podcast Ads" } });
    fireEvent.click(screen.getByRole("button", { name: /^Adicionar$/i }));
    const canvas = screen.getByTestId("journey-canvas");
    expect(canvas.querySelectorAll(".react-flow__node").length).toBe(1);
  });
});
