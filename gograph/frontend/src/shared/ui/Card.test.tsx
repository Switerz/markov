import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders composed structure", () => {
    render(
      <Card>
        <Card.Header>
          <Card.Title>Conversões por canal</Card.Title>
          <Card.Description>Últimos 30 dias</Card.Description>
        </Card.Header>
        <Card.Body>
          <p>corpo</p>
        </Card.Body>
        <Card.Footer>rodapé</Card.Footer>
      </Card>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: /conversões por canal/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/últimos 30 dias/i)).toBeInTheDocument();
    expect(screen.getByText("corpo")).toBeInTheDocument();
    expect(screen.getByText("rodapé")).toBeInTheDocument();
  });
});
