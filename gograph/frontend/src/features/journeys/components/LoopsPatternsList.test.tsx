import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoopsPatternsList } from "./LoopsPatternsList";
import { journeysMock } from "../journeys.mock";

describe("LoopsPatternsList", () => {
  it("renders 4 patterns", () => {
    render(<LoopsPatternsList loops={journeysMock.loopsAndPatterns} />);
    expect(screen.getByText("Loops e padrões")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp CRM → WhatsApp CRM")).toBeInTheDocument();
    expect(screen.getByText("Meta Ads → Meta Ads")).toBeInTheDocument();
    expect(screen.getByText("Direct → Direct")).toBeInTheDocument();
    expect(screen.getByText("Email → Email")).toBeInTheDocument();
  });
});
