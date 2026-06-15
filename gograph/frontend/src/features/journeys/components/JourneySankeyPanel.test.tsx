import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { JourneySankeyPanel, parsePercent } from "./JourneySankeyPanel";
import { journeysMock } from "../journeys.mock";

describe("JourneySankeyPanel", () => {
  it("renders title and subtitle", () => {
    render(
      <JourneySankeyPanel
        flow={journeysMock.journeyFlow}
        metric={journeysMock.flowMetric}
      />,
    );
    expect(screen.getByText("Fluxo de jornadas")).toBeInTheDocument();
    expect(
      screen.getByText(/Participação de jornadas por toque/),
    ).toBeInTheDocument();
  });

  it("parsePercent handles Brazilian-formatted percentages", () => {
    expect(parsePercent("32,1%")).toBeCloseTo(0.321);
    expect(parsePercent("0%")).toBe(0);
    expect(parsePercent("abc")).toBe(0);
  });
});
