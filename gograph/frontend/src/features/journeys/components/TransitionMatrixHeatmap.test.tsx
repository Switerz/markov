import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransitionMatrixHeatmap } from "./TransitionMatrixHeatmap";
import { journeysMock } from "../journeys.mock";

describe("TransitionMatrixHeatmap", () => {
  it("renders correct row + column counts", () => {
    render(
      <TransitionMatrixHeatmap matrix={journeysMock.transitionMatrix} />,
    );
    expect(screen.getByText("Matriz de transição")).toBeInTheDocument();
    // 7 columns × 7 rows + corner; verify by counting column header cells.
    const cols = screen.getAllByRole("columnheader");
    // 7 channels + 1 corner.
    expect(cols).toHaveLength(8);
    const rows = screen.getAllByRole("rowheader");
    expect(rows).toHaveLength(7);
  });
});
