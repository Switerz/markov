import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatDelta } from "./StatDelta";

describe("StatDelta", () => {
  it("renders positive tone with label", () => {
    render(<StatDelta value="+12%" label="vs. semana passada" tone="positive" />);
    expect(screen.getByText("+12%")).toBeInTheDocument();
    expect(screen.getByText(/vs\. semana passada/i)).toBeInTheDocument();
  });
  it("renders negative tone", () => {
    render(<StatDelta value="-5%" tone="negative" />);
    expect(screen.getByText("-5%")).toBeInTheDocument();
  });
  it("renders warning tone", () => {
    render(<StatDelta value="-2,3 p.p." tone="warning" />);
    expect(screen.getByText("-2,3 p.p.")).toBeInTheDocument();
  });
  it("renders neutral tone", () => {
    render(<StatDelta value="0" tone="neutral" />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
