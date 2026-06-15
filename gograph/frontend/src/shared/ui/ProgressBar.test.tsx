import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders with role progressbar and aria-valuenow", () => {
    render(<ProgressBar value={0.42} label="Orçamento" rightLabel="42%" tone="blue" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByText("Orçamento")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("clamps value below 0 and above 1", () => {
    const { rerender } = render(<ProgressBar value={-0.5} tone="green" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    rerender(<ProgressBar value={1.5} tone="green" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
