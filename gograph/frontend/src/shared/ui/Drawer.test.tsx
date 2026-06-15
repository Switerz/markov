import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Drawer } from "./Drawer";

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) onClose?.();
      }}
      title="Detalhes da campanha"
    >
      <p>Conteúdo do drawer</p>
    </Drawer>
  );
}

describe("Drawer", () => {
  it("renders title and body when open", () => {
    render(<Harness />);
    expect(screen.getByText(/detalhes da campanha/i)).toBeInTheDocument();
    expect(screen.getByText(/conteúdo do drawer/i)).toBeInTheDocument();
  });

  it("accepts a ReactNode title (icon + text + badge composition)", () => {
    const [open, setOpen] = [true, () => {}];
    render(
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={
          <span>
            <span data-testid="title-icon">icn</span>
            Google Ads
            <span data-testid="title-badge">Escalar</span>
          </span>
        }
      >
        <p>body</p>
      </Drawer>,
    );
    expect(screen.getByTestId("title-icon")).toBeInTheDocument();
    expect(screen.getByText(/google ads/i)).toBeInTheDocument();
    expect(screen.getByTestId("title-badge")).toBeInTheDocument();
  });

  it("close button has aria-label", () => {
    render(<Harness />);
    expect(screen.getByLabelText(/fechar drawer/i)).toBeInTheDocument();
  });

  it("Esc closes the drawer", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
