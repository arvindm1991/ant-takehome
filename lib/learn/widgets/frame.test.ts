import { describe, expect, it } from "vitest";
import { extractHtml, frameWidgetHtml } from "./frame";
import { MOCK_WIDGETS } from "./mock";

describe("widget framing", () => {
  it("puts a network-blocking CSP before any widget content, and the bridge before </body>", () => {
    const out = frameWidgetHtml("<!doctype html><html><script>fetch('https://evil')</script><head><title>x</title></head><body><input></body></html>");
    expect(out).toMatch(/^<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'/);
    expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("fetch("));
    expect(out.indexOf("__widget")).toBeLessThan(out.lastIndexOf("</body>"));
  });
  it("handles fragments", () => {
    const out = frameWidgetHtml("<button>hi</button>");
    expect(out).toMatch(/^<!doctype html><meta http-equiv="Content-Security-Policy"/);
    expect(out).toContain("<button>hi</button>");
  });
  it("extracts HTML from fenced model output", () => {
    expect(extractHtml("Here you go:\n```html\n<!doctype html><html></html>\n```")).toBe("<!doctype html><html></html>");
  });
  it("mock widgets are interactive documents", () => {
    for (const w of Object.values(MOCK_WIDGETS)) expect(w.html).toMatch(/<script>[\s\S]*addEventListener|onclick/);
  });
});
