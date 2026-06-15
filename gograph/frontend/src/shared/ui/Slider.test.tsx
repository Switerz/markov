import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Slider } from "./Slider";

describe("Slider", () => {
  it("renders single thumb", () => {
    render(<Slider defaultValue={[40]} min={0} max={100} />);
    const thumbs = screen.getAllByRole("slider");
    expect(thumbs).toHaveLength(1);
    expect(thumbs[0]).toHaveAttribute("aria-valuenow", "40");
  });

  it("renders range with two thumbs", () => {
    render(<Slider value={[20, 80]} min={0} max={100} onValueChange={() => {}} />);
    const thumbs = screen.getAllByRole("slider");
    expect(thumbs).toHaveLength(2);
  });

  it("renders marks when provided", () => {
    render(<Slider defaultValue={[50]} min={0} max={100} marks={["0", "50", "100"]} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });
});
