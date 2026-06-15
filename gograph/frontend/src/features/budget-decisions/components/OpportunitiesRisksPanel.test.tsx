import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpportunitiesRisksPanel } from "./OpportunitiesRisksPanel";
import { budgetDecisionsMock } from "../budget-decisions.mock";

describe("OpportunitiesRisksPanel", () => {
  it("renders all opportunities and risks", () => {
    render(
      <OpportunitiesRisksPanel
        data={budgetDecisionsMock.opportunitiesAndRisks}
      />,
    );
    expect(screen.getByText("Oportunidades de escala")).toBeInTheDocument();
    expect(screen.getByText("Riscos de redução")).toBeInTheDocument();
    // 3 opportunities + 2 risks = 5 channel names rendered.
    ["Google Ads", "Meta Ads", "WhatsApp CRM", "Organic Search", "Direct"].forEach(
      (ch) => expect(screen.getByText(ch)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Nossos modelos indicam/)).toBeInTheDocument();
  });
});
