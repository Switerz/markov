import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  const { Children, cloneElement, isValidElement } = await import("react");
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

import { BarLineTrendChart, type TrendDatum } from "./BarLineTrendChart";

const data: TrendDatum[] = [
  {
    period: "Jan",
    bars: [
      { key: "leads", value: 100, tone: "blue", label: "Leads" },
      { key: "sales", value: 30, tone: "green", label: "Sales" },
    ],
    line: { value: 30, label: "Conv %" },
  },
  {
    period: "Feb",
    bars: [
      { key: "leads", value: 120, tone: "blue", label: "Leads" },
      { key: "sales", value: 40, tone: "green", label: "Sales" },
    ],
    line: { value: 33, label: "Conv %" },
  },
];

describe("BarLineTrendChart", () => {
  it("renders periods on x axis", () => {
    render(<BarLineTrendChart data={data} />);
    expect(screen.getByText("Jan")).toBeInTheDocument();
    expect(screen.getByText("Feb")).toBeInTheDocument();
  });

  it("renders legend with each bar series name", () => {
    render(<BarLineTrendChart data={data} />);
    expect(screen.getByText("Leads")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
  });
});
