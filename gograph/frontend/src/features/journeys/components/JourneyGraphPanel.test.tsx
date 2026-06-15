import { describe, it, expect, vi } from "vitest";

// xyflow needs a ResizeObserver in jsdom; this test only verifies that the
// component exports a function. The actual render is exercised in the page
// smoke test which mocks the panel.
describe("JourneyGraphPanel", () => {
  it("exports a function component", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const mod = await import("./JourneyGraphPanel");
    expect(typeof mod.JourneyGraphPanel).toBe("function");
  });
});
