import { describe, it, expect } from "vitest";
import { formatBRL, formatCompactBRL } from "./currency";
import { formatPercent, formatPercentPoints } from "./percent";
import { formatMultiplier, formatNumber } from "./number";

describe("formatters", () => {
  it("formatBRL", () => {
    const out = formatBRL(24800000);
    expect(out).toMatch(/^R\$\s?24\.800\.000,00$/);
  });
  it("formatCompactBRL", () => {
    expect(formatCompactBRL(24800000)).toBe("R$ 24,8M");
  });
  it("formatPercent", () => {
    expect(formatPercent(0.0348)).toBe("3,48%");
  });
  it("formatPercentPoints positive", () => {
    expect(formatPercentPoints(0.0039)).toBe("+0,39 p.p.");
  });
  it("formatMultiplier", () => {
    expect(formatMultiplier(6.02)).toBe("6,02x");
  });
  it("formatNumber compact", () => {
    expect(formatNumber(16492, { compact: true })).toMatch(/16,5\s?mil/);
  });
});
