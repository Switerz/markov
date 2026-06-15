import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModelConsensusMatrix } from "./ModelConsensusMatrix";
import { overviewMock } from "../overview.mock";

describe("ModelConsensusMatrix", () => {
  it("renders the matrix card with axes and a bubble per channel point", () => {
    const { container } = render(
      <ModelConsensusMatrix consensus={overviewMock.modelConsensus} />,
    );
    expect(screen.getByText("Consenso dos modelos")).toBeInTheDocument();
    expect(screen.getAllByText(/markov/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/shapley/i).length).toBeGreaterThan(0);
    const bubbles = container.querySelectorAll('[data-testid^="bubble-"]');
    expect(bubbles.length).toBe(overviewMock.modelConsensus.points.length);
  });
});
