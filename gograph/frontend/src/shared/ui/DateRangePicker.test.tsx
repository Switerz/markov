import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateRangePicker, type DateRange } from "./DateRangePicker";

function Harness({ onChange }: { onChange: (v: DateRange) => void }) {
  const [value, setValue] = useState<DateRange>({ from: null, to: null });
  return (
    <DateRangePicker
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
      label="Período"
    />
  );
}

describe("DateRangePicker", () => {
  it("renders trigger with default summary", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: /período/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).toContain("— → —");
  });

  it("parses typed dd/MM/yyyy on blur and calls onChange", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /período/i }));
    const inputs = screen.getAllByPlaceholderText("dd/mm/aaaa");
    const fromInput = inputs[0];
    fireEvent.change(fromInput, { target: { value: "01/01/2024" } });
    fireEvent.blur(fromInput);
    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls[onChange.mock.calls.length - 1][0] as DateRange;
    expect(arg.from).not.toBeNull();
    expect(arg.from?.getFullYear()).toBe(2024);
  });
});
