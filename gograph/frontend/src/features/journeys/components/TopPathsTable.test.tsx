import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopPathsTable } from "./TopPathsTable";
import { journeysMock } from "../journeys.mock";

describe("TopPathsTable", () => {
  it("renders 5 rows", () => {
    render(<TopPathsTable paths={journeysMock.topPaths} />);
    expect(screen.getByText("Top caminhos")).toBeInTheDocument();
    // The mock provides 5 ranked paths. We verify by their unique revenue.
    expect(screen.getByText("R$ 1,24M")).toBeInTheDocument();
    expect(screen.getByText("R$ 1,02M")).toBeInTheDocument();
    expect(screen.getByText("R$ 648K")).toBeInTheDocument();
    expect(screen.getByText("R$ 412K")).toBeInTheDocument();
    expect(screen.getByText("R$ 372K")).toBeInTheDocument();
  });
});
