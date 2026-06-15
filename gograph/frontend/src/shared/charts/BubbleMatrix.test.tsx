import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BubbleMatrix, type BubblePoint, type Quadrant } from "./BubbleMatrix";

const points: BubblePoint[] = [
  { id: "a", x: 10, y: 20, size: 100, tone: "blue", label: "Alpha" },
  { id: "b", x: 30, y: 40, size: 200, tone: "green", label: "Beta" },
  { id: "c", x: 50, y: 60, size: 300, tone: "red", label: "Gamma" },
];

const quadrants: Quadrant[] = [
  { label: "Q1", position: "top-left", description: "desc1" },
  { label: "Q2", position: "top-right" },
];

describe("BubbleMatrix", () => {
  it("renders one circle per point", () => {
    const { container } = render(
      <BubbleMatrix points={points} axes={{ x: "CPL", y: "ROAS" }} />,
    );
    const groups = container.querySelectorAll('[data-testid^="bubble-"]');
    expect(groups).toHaveLength(3);
  });

  it("calls onPointClick when bubble clicked", () => {
    const handler = vi.fn();
    const { container } = render(
      <BubbleMatrix
        points={points}
        axes={{ x: "CPL", y: "ROAS" }}
        onPointClick={handler}
      />,
    );
    const first = container.querySelector('[data-testid="bubble-a"]');
    expect(first).not.toBeNull();
    fireEvent.click(first as Element);
    expect(handler).toHaveBeenCalledWith("a");
  });

  it("renders quadrant labels", () => {
    render(
      <BubbleMatrix
        points={points}
        axes={{ x: "CPL", y: "ROAS" }}
        quadrants={quadrants}
      />,
    );
    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.getByText("Q2")).toBeInTheDocument();
    expect(screen.getByText("desc1")).toBeInTheDocument();
  });

  it("renders axis titles", () => {
    render(
      <BubbleMatrix points={points} axes={{ x: "CPL Axis", y: "ROAS Axis" }} />,
    );
    expect(screen.getByText("CPL Axis")).toBeInTheDocument();
    expect(screen.getByText("ROAS Axis")).toBeInTheDocument();
  });
});
