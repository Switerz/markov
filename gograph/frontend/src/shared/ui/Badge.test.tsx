import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders soft blue (default variant)", () => {
    render(<Badge tone="blue">Beta</Badge>);
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });
  it("renders solid red", () => {
    render(
      <Badge tone="red" variant="solid">
        Erro
      </Badge>,
    );
    expect(screen.getByText("Erro")).toBeInTheDocument();
  });
  it("renders outline green", () => {
    render(
      <Badge tone="green" variant="outline">
        OK
      </Badge>,
    );
    expect(screen.getByText("OK")).toBeInTheDocument();
  });
  it("renders soft orange size sm", () => {
    render(
      <Badge tone="orange" size="sm">
        Aviso
      </Badge>,
    );
    expect(screen.getByText("Aviso")).toBeInTheDocument();
  });
  it("renders solid indigo", () => {
    render(
      <Badge tone="indigo" variant="solid">
        Acento
      </Badge>,
    );
    expect(screen.getByText("Acento")).toBeInTheDocument();
  });
  it("renders outline cyan", () => {
    render(
      <Badge tone="cyan" variant="outline">
        ROAS
      </Badge>,
    );
    expect(screen.getByText("ROAS")).toBeInTheDocument();
  });
});
