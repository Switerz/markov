import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AllocationMatrix } from "./AllocationMatrix";
import { budgetDecisionsMock } from "../budget-decisions.mock";

describe("AllocationMatrix", () => {
  it("renders title and helper text", () => {
    render(<AllocationMatrix matrix={budgetDecisionsMock.allocationMatrix} />);
    expect(screen.getByText("Matriz de alocação")).toBeInTheDocument();
    expect(screen.getByText(/Canais no quadrante Escalar/i)).toBeInTheDocument();
  });

  it("invokes onPointClick with the channel id", () => {
    const onPointClick = vi.fn();
    render(
      <AllocationMatrix
        matrix={budgetDecisionsMock.allocationMatrix}
        onPointClick={onPointClick}
      />,
    );
    const bubble = screen.getByTestId("bubble-Google Ads");
    fireEvent.click(bubble);
    expect(onPointClick).toHaveBeenCalledWith("Google Ads");
  });
});
