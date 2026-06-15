import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TopBar } from "./TopBar";

describe("TopBar", () => {
  it("renders title and subtitle", () => {
    render(
      <MemoryRouter>
        <TopBar title="Visão Geral" subtitle="Dashboard" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: /visão geral/i })).toBeInTheDocument();
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  });

  it("renders breadcrumb with links", () => {
    render(
      <MemoryRouter>
        <TopBar
          title="Canal 360"
          breadcrumb={[
            { label: "Decisões de Budget", to: "/decisoes-de-budget" },
            { label: "Google Ads" },
          ]}
        />
      </MemoryRouter>,
    );
    const crumbNav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(crumbNav).toBeInTheDocument();
    const crumbLink = screen.getByRole("link", { name: /decisões de budget/i });
    expect(crumbLink).toHaveAttribute("href", "/decisoes-de-budget");
    expect(screen.getByText(/google ads/i)).toBeInTheDocument();
  });

  it("renders filters and actions slots", () => {
    render(
      <MemoryRouter>
        <TopBar
          title="Página"
          filters={<button>Filtrar</button>}
          actions={<button>Exportar</button>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /filtrar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /exportar/i })).toBeInTheDocument();
  });
});
