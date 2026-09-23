import { describe, expect, it } from "vitest";
import { extractHtml, frameWidgetHtml } from "./frame";
import { MOCK_WIDGETS } from "./mock";

describe("widget framing", () => {
  it("injects a network-blocking CSP into <head> and the resize bridge before </body>", () => {
    const out = frameWidgetHtml("<!doctype html><html><head><title>x</title></head><body><input></body></html>");
    expect(out).toMatch(/<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'/);
    expect(out.indexOf("__widget")).toBeLessThan(out.indexOf("</body>"));
  });
  it("wraps fragments into a full document", () => {
    const out = frameWidgetHtml("<button>hi</button>");
    expect(out).toMatch(/^<!doctype html><html><head><meta http-equiv/);
  });
  it("extracts HTML from fenced model output", () => {
    expect(extractHtml("Here you go:\n```html\n<!doctype html><html></html>\n```")).toBe("<!doctype html><html></html>");
  });
  it("mock widgets are interactive documents", () => {
    for (const w of Object.values(MOCK_WIDGETS)) expect(w.html).toMatch(/<script>[\s\S]*addEventListener|onclick/);
  });
});
