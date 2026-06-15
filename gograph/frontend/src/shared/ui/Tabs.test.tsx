import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "./Tabs";

function Harness() {
  const [value, setValue] = useState("a");
  return (
    <Tabs.Root value={value} onValueChange={setValue}>
      <Tabs.List>
        <Tabs.Trigger value="a">Resumo</Tabs.Trigger>
        <Tabs.Trigger value="b">Detalhes</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="a">Conteúdo A</Tabs.Content>
      <Tabs.Content value="b">Conteúdo B</Tabs.Content>
    </Tabs.Root>
  );
}

describe("Tabs", () => {
  it("switches content on trigger click", () => {
    render(<Harness />);
    expect(screen.getByText("Conteúdo A")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo B")).not.toBeInTheDocument();

    const trigger = screen.getByRole("tab", { name: /detalhes/i });
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.click(trigger);
    expect(screen.getByText("Conteúdo B")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo A")).not.toBeInTheDocument();
  });
});
