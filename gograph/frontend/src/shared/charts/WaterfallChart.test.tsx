import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  const Children = (await import("react")).Children;
  const cloneElement = (await import("react")).cloneElement;
  const isValidElement = (await import("react")).isValidElement;
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => {
      const arr = Children.toArray(children);
      return (
        <div style={{ width: 600, height: 320 }}>
          {arr.map((c, i) =>
            isValidElement(c)
              ? cloneElement(c as React.ReactElement<{ width?: number; height?: number }>, {
                  width: 600,
                  height: 320,
                  key: i,
                })
              : c,
          )}
        </div>
      );
    },
  };
});

import { WaterfallChart, type WaterfallStep } from "./WaterfallChart";

const steps: WaterfallStep[] = [
  { label: "Start", value: 100, display: "100", type: "start" },
  { label: "Add", value: 30, display: "+30", type: "positive" },
  { label: "Subtract", value: -20, display: "-20", type: "negative" },
  { label: "Bridge", value: 0, display: "", type: "bridge" },
  { label: "End", value: 110, display: "110", type: "end" },
];

describe("WaterfallChart", () => {
  it("renders one x-axis tick per step (including bridge)", () => {
    render(<WaterfallChart steps={steps} />);
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
    expect(screen.getByText("Subtract")).toBeInTheDocument();
    expect(screen.getByText("End")).toBeInTheDocument();
  });

  it("renders display labels for non-bridge steps", () => {
    render(<WaterfallChart steps={steps} />);
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("+30")).toBeInTheDocument();
    expect(screen.getByText("-20")).toBeInTheDocument();
    expect(screen.getByText("110")).toBeInTheDocument();
  });
});
