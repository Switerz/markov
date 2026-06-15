import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScenarioBuilderForm } from "./ScenarioBuilderForm";
import { experimentsMock } from "../experiments.mock";

describe("ScenarioBuilderForm", () => {
  it("renders 4 action-type pills, 4 inputs and submit button", () => {
    render(
      <ScenarioBuilderForm
        builder={experimentsMock.scenarioBuilder}
        onApply={vi.fn()}
      />,
    );
    // 4 action-type pills
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(
      screen.getByRole("radio", { name: /Remover canal/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Reduzir presença/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Redistribuir budget/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Comparar modelos/i }),
    ).toBeInTheDocument();

    // 4 form inputs (channel select, action select, intensity slider, period input)
    // Channel + Action selects
    expect(
      screen.getByRole("combobox", { name: /Canal \/ Tática/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Ação$/i })).toBeInTheDocument();
    // Intensity slider thumb exposes a slider role
    expect(screen.getByRole("slider")).toBeInTheDocument();
    // Period input
    expect(
      screen.getByRole("textbox", { name: /Período de simulação/i }),
    ).toBeInTheDocument();

    // Submit button
    expect(
      screen.getByRole("button", { name: /Aplicar cenário/i }),
    ).toBeInTheDocument();
  });
});
