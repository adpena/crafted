import { describe, it, expect } from "vitest";
import { sanitizeCustomCss, MAX_CUSTOM_CSS_BYTES } from "../src/lib/sanitize-css.ts";

describe("sanitizeCustomCss", () => {
  it("passes through simple rules", () => {
    const r = sanitizeCustomCss("body { color: red; }");
    expect(r.rejected).toBe(false);
    expect(r.css).toBe("body { color: red; }");
  });

  it("accepts empty/null/undefined as empty", () => {
    expect(sanitizeCustomCss("").css).toBe("");
    expect(sanitizeCustomCss(null).css).toBe("");
    expect(sanitizeCustomCss(undefined).css).toBe("");
  });

  it("rejects non-strings", () => {
    expect(sanitizeCustomCss(123).rejected).toBe(true);
    expect(sanitizeCustomCss({}).rejected).toBe(true);
    expect(sanitizeCustomCss([]).rejected).toBe(true);
  });

  it("rejects style tag breakout", () => {
    const r = sanitizeCustomCss("body{} </style><script>alert(1)</script>");
    expect(r.rejected).toBe(true);
    expect(r.reason).toBe("style_tag_breakout");
  });

  it("rejects raw script tag", () => {
    const r = sanitizeCustomCss("/* nope */ <script>x</script>");
    // strip comments first, <script> stays
    expect(r.rejected).toBe(true);
  });

  it("rejects CSS expression()", () => {
    const r = sanitizeCustomCss("x { width: expression(alert(1)); }");
    expect(r.rejected).toBe(true);
    expect(r.reason).toBe("css_expression");
  });

  it("rejects expression() hidden in comments", () => {
    const r = sanitizeCustomCss("x { width: ex/**/pression(alert(1)); }");
    expect(r.rejected).toBe(true);
    expect(r.reason).toBe("css_expression");
  });

  it("rejects javascript: url", () => {
    const r = sanitizeCustomCss("a { background: url(javascript:alert(1)); }");
    expect(r.rejected).toBe(true);
  });

  it("rejects data: url", () => {
    const r = sanitizeCustomCss('a { background: url("data:text/html,x"); }');
    expect(r.rejected).toBe(true);
    expect(r.reason).toBe("data_url");
  });

  it("allows url(https://...) for fonts/images", () => {
    const r = sanitizeCustomCss("@font-face { src: url(https://fonts.example.com/f.woff2); }");
    expect(r.rejected).toBe(false);
  });

  it("rejects @import", () => {
    const r = sanitizeCustomCss('@import url("https://evil.example.com/x.css");');
    expect(r.rejected).toBe(true);
    expect(r.reason).toBe("css_import");
  });

  it("rejects ie behavior:", () => {
    const r = sanitizeCustomCss("x { behavior: url(x.htc); }");
    expect(r.rejected).toBe(true);
  });

  it("rejects -moz-binding", () => {
    const r = sanitizeCustomCss("x { -moz-binding: url(x.xml#y); }");
    expect(r.rejected).toBe(true);
  });

  it("rejects oversize payload", () => {
    const big = "a".repeat(MAX_CUSTOM_CSS_BYTES + 1);
    const r = sanitizeCustomCss(big);
    expect(r.rejected).toBe(true);
    expect(r.reason).toBe("too_large");
  });

  it("strips null bytes", () => {
    const r = sanitizeCustomCss("body\u0000 { color: red; }");
    expect(r.rejected).toBe(false);
    expect(r.css).not.toContain("\u0000");
  });

  it("strips comments in output", () => {
    const r = sanitizeCustomCss("/* hi */ body { color: red; }");
    expect(r.rejected).toBe(false);
    expect(r.css).not.toContain("/*");
  });
});
