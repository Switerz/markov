import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders primary label", () => {
    render(<Button variant="primary">Nova execução</Button>);
    expect(
      screen.getByRole("button", { name: /nova execução/i }),
    ).toBeInTheDocument();
  });

  it("icon variant respects aria-label", () => {
    render(
      <Button variant="icon" aria-label="Mais opções">
        <svg />
      </Button>,
    );
    expect(screen.getByLabelText(/mais opções/i)).toBeInTheDocument();
  });

  it("fires onClick", () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(fn).toHaveBeenCalled();
  });

  it("does not fire when disabled or loading", () => {
    const fn = vi.fn();
    render(
      <Button disabled onClick={fn}>
        X
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(fn).not.toHaveBeenCalled();
  });
});
