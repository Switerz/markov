import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Providers } from "./Providers";

describe("Providers", () => {
  it("renders children inside providers", () => {
    const { getByText } = render(
      <Providers>
        <span>hello</span>
      </Providers>,
    );
    expect(getByText("hello")).toBeTruthy();
  });
});
