import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JourneyBuilder } from "./JourneyBuilder";
import { journeysMock } from "../journeys.mock";

describe("JourneyBuilder", () => {
  it("renders 4 initial steps, adds a step via quick suggestion, resets to 4", () => {
    render(<JourneyBuilder builder={journeysMock.journeyBuilder} />);
    const list = screen.getByRole("list", { name: /Caminho/i });
    // Initial: 4 steps (Entrada, Meta Ads, WhatsApp CRM, Conversão).
    expect(list.querySelectorAll("[role='listitem']")).toHaveLength(4);

    // Click the first quick suggestion (Google Ads).
    fireEvent.click(screen.getByRole("button", { name: "Google Ads" }));
    expect(list.querySelectorAll("[role='listitem']")).toHaveLength(5);

    // Reset.
    fireEvent.click(screen.getByRole("button", { name: /Limpar/i }));
    expect(list.querySelectorAll("[role='listitem']")).toHaveLength(4);
  });
});
