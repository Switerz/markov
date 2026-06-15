import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendingUp } from "lucide-react";
import { IconTile } from "./IconTile";

describe("IconTile", () => {
  it("renders children", () => {
    render(
      <IconTile tone="blue" size="md">
        <span data-testid="kid">child</span>
      </IconTile>,
    );
    expect(screen.getByTestId("kid")).toBeInTheDocument();
  });

  it("renders different tones and sizes without crashing", () => {
    render(
      <IconTile tone="green" size="lg">
        <TrendingUp size={18} />
      </IconTile>,
    );
    // No assertion needed beyond render — smoke test.
    expect(document.querySelector("span")).toBeInTheDocument();
  });
});
