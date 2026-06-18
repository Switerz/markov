import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );

describe("Sidebar", () => {
  it("renders nav landmark with all main items", () => {
    renderAt("/");
    expect(screen.getByRole("navigation", { name: /navegação principal/i })).toBeInTheDocument();
    ["Visão Geral", "Performance", "Jornadas", "Experimentos", "Execuções & Qualidade", "Configurações"].forEach((label) =>
      expect(screen.getByRole("link", { name: new RegExp(label, "i") })).toBeInTheDocument(),
    );
  });

  it("marks the active route", () => {
    renderAt("/jornadas");
    const active = screen.getByRole("link", { name: /jornadas/i });
    expect(active).toHaveAttribute("aria-current", "page");
  });

  it("home is only active at '/' (exact match)", () => {
    renderAt("/jornadas");
    const home = screen.getByRole("link", { name: /visão geral/i });
    expect(home).not.toHaveAttribute("aria-current", "page");
  });
});
