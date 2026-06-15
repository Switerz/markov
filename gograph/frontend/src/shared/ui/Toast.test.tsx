import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToastProvider, useToast } from "./Toast";

function TestButton() {
  const { push } = useToast();
  return (
    <button type="button" onClick={() => push("Cenário salvo", "green")}>
      Push
    </button>
  );
}

describe("Toast", () => {
  it("pushes a toast that appears in the DOM with the right tone", () => {
    render(
      <ToastProvider>
        <TestButton />
      </ToastProvider>,
    );
    expect(screen.queryByText("Cenário salvo")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Push" }));
    expect(screen.getByText("Cenário salvo")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
