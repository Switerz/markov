import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Select } from "./Select";

describe("Select", () => {
  it("renders trigger with placeholder", () => {
    render(
      <Select placeholder="Selecione" ariaLabel="Canal">
        <Select.Item value="a">Google Ads</Select.Item>
        <Select.Item value="b">Meta Ads</Select.Item>
        <Select.Item value="c">Direct</Select.Item>
      </Select>,
    );
    expect(screen.getByLabelText(/canal/i)).toBeInTheDocument();
    expect(screen.getByText("Selecione")).toBeInTheDocument();
  });

  it("shows selected value when controlled", () => {
    render(
      <Select value="b" ariaLabel="Canal">
        <Select.Item value="a">Google Ads</Select.Item>
        <Select.Item value="b">Meta Ads</Select.Item>
        <Select.Item value="c">Direct</Select.Item>
      </Select>,
    );
    expect(screen.getByText("Meta Ads")).toBeInTheDocument();
  });

  it("respects disabled state", () => {
    render(
      <Select disabled ariaLabel="Canal" placeholder="X">
        <Select.Item value="a">A</Select.Item>
      </Select>,
    );
    const trigger = screen.getByLabelText(/canal/i);
    expect(trigger).toHaveAttribute("data-disabled");
  });
});
