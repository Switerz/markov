import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendingUp } from "lucide-react";
import { MetricCard } from "./MetricCard";

describe("MetricCard", () => {
  it("renders title, value and delta", () => {
    render(
      <MetricCard
        title="Receita atribuída"
        value="R$ 24,8M"
        subtitle="Últimos 30 dias"
        delta={{ value: "+12,4%", label: "vs. período anterior", tone: "positive" }}
        icon={<TrendingUp size={18} />}
        tone="blue"
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: /receita atribuída/i })).toBeInTheDocument();
    expect(screen.getByText("R$ 24,8M")).toBeInTheDocument();
    expect(screen.getByText(/últimos 30 dias/i)).toBeInTheDocument();
    expect(screen.getByText("+12,4%")).toBeInTheDocument();
    expect(screen.getByText(/vs\. período anterior/i)).toBeInTheDocument();
  });

  it("renders without delta", () => {
    render(
      <MetricCard
        title="Sessões"
        value="16,5 mil"
        icon={<TrendingUp size={18} />}
        tone="cyan"
      />,
    );
    expect(screen.getByText("16,5 mil")).toBeInTheDocument();
  });
});
