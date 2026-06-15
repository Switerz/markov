import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AttributionRedistributionWaterfall } from "./AttributionRedistributionWaterfall";
import { experimentsMock } from "../experiments.mock";

describe("AttributionRedistributionWaterfall", () => {
  it("renders title and footer note", () => {
    render(
      <AttributionRedistributionWaterfall
        redistribution={experimentsMock.redistributionChart}
      />,
    );
    expect(screen.getByText(/Redistribuição da atribuição/i)).toBeInTheDocument();
    expect(
      screen.getByText(/A remoção de Display reduz a receita atribuída/i),
    ).toBeInTheDocument();
  });
});
