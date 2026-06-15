import "@testing-library/jest-dom/vitest";

// jsdom polyfills required by Radix UI primitives.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  // @ts-expect-error attach mock to global for Radix consumers
  globalThis.ResizeObserver = ResizeObserverMock;
}

// jsdom lacks PointerEvent / pointer capture, which Radix Select uses.
if (typeof window !== "undefined") {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
}
