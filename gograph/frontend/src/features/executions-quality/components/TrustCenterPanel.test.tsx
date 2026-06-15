import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrustCenterPanel } from "./TrustCenterPanel";
import { executionsQualityMock } from "../executions-quality.mock";

describe("TrustCenterPanel", () => {
  it("renders all sub-section titles", () => {
    render(<TrustCenterPanel trust={executionsQualityMock.trustCenter} />);
    expect(screen.getByText("Trust Center")).toBeInTheDocument();
    expect(screen.getByText("Confiança geral")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Calibração do modelo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Qualidade dos dados" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /Alertas críticos \(2\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Checks de qualidade" }),
    ).toBeInTheDocument();
  });
});
