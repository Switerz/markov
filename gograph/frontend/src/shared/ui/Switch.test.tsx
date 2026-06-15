import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Switch } from "./Switch";

describe("Switch", () => {
  it("toggles and fires onCheckedChange", () => {
    const onChange = vi.fn();
    render(<Switch aria-label="Ativar feature" onCheckedChange={onChange} />);
    const sw = screen.getByLabelText(/ativar feature/i);
    expect(sw).toHaveAttribute("data-state", "unchecked");
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders checked state", () => {
    render(<Switch aria-label="X" checked onCheckedChange={() => {}} />);
    expect(screen.getByLabelText("X")).toHaveAttribute("data-state", "checked");
  });
});
