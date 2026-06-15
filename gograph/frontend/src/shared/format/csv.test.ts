import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toCsv, downloadCsv } from "./csv";

describe("toCsv", () => {
  it("returns empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });

  it("emits header + rows", () => {
    const csv = toCsv([
      { name: "A", count: 1 },
      { name: "B", count: 2 },
    ]);
    expect(csv).toBe("name,count\nA,1\nB,2");
  });

  it("quotes cells with commas, quotes, or newlines", () => {
    const csv = toCsv([{ a: "x,y", b: 'has "quote"', c: "line\nbreak" }]);
    expect(csv).toBe('a,b,c\n"x,y","has ""quote""","line\nbreak"');
  });

  it("treats null/undefined as empty", () => {
    const csv = toCsv([{ a: null, b: undefined, c: 0 }]);
    expect(csv).toBe("a,b,c\n,,0");
  });
});

describe("downloadCsv", () => {
  const origCreateObj = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  let clicked = false;
  let removed = false;
  let downloadName: string | null = null;

  beforeEach(() => {
    clicked = false;
    removed = false;
    downloadName = null;
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") {
        Object.defineProperty(el, "click", {
          value: () => {
            clicked = true;
          },
          configurable: true,
        });
        const origRemove = el.remove.bind(el);
        el.remove = () => {
          removed = true;
          origRemove();
        };
        // Capture download attribute when set
        Object.defineProperty(el, "download", {
          set(v: string) {
            downloadName = v;
          },
          get() {
            return downloadName ?? "";
          },
          configurable: true,
        });
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    URL.createObjectURL = origCreateObj;
    URL.revokeObjectURL = origRevoke;
  });

  it("creates an anchor, clicks it, and revokes the URL", () => {
    downloadCsv("test.csv", [{ a: 1, b: 2 }]);
    expect(clicked).toBe(true);
    expect(removed).toBe(true);
    expect(downloadName).toBe("test.csv");
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});
