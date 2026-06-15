import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./Tooltip";

describe("Tooltip", () => {
  it("renders trigger and opens content when controlled open", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>Hover-me</TooltipTrigger>
          <TooltipContent>Dica útil</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByText("Hover-me")).toBeInTheDocument();
    // Radix renders the content twice (visible + accessibility a11y mirror).
    const matches = screen.getAllByText(/dica útil/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
