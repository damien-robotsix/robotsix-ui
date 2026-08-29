import { afterEach, describe, expect, it } from "vitest";
import { cssEscape, escAttr, escHtml, renderInlineMarkdown } from "./html.js";

describe("escHtml", () => {
  it("escapes every character in the ESCAPES table", () => {
    expect(escHtml("&")).toBe("&amp;");
    expect(escHtml("<")).toBe("&lt;");
    expect(escHtml(">")).toBe("&gt;");
    expect(escHtml('"')).toBe("&quot;");
    expect(escHtml("'")).toBe("&#39;");
  });

  it("escapes all special characters in a mixed string", () => {
    expect(escHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });

  it("leaves ordinary text untouched", () => {
    expect(escHtml("hello world 123")).toBe("hello world 123");
  });

  it("coerces non-string values via String()", () => {
    expect(escHtml(42)).toBe("42");
    expect(escHtml(null)).toBe("null");
    expect(escHtml(undefined)).toBe("undefined");
    expect(escHtml(true)).toBe("true");
  });
});

describe("escAttr", () => {
  it("escapes the same characters as escHtml", () => {
    const raw = `<b>"quote" & 'apos'</b>`;
    expect(escAttr(raw)).toBe(escHtml(raw));
  });

  it("escapes double quotes so attribute context cannot break out", () => {
    expect(escAttr('" onmouseover="alert(1)')).toBe("&quot; onmouseover=&quot;alert(1)");
  });
});

describe("cssEscape", () => {
  it("delegates to CSS.escape when available", () => {
    expect(typeof globalThis.CSS?.escape).toBe("function");
    expect(cssEscape("a.b#c")).toBe(globalThis.CSS.escape("a.b#c"));
  });

  describe("fallback when CSS.escape is unavailable", () => {
    const original = globalThis.CSS;

    afterEach(() => {
      globalThis.CSS = original;
    });

    it("returns the value unchanged when globalThis.CSS is missing", () => {
      // @ts-expect-error deliberately removing the API to exercise the fallback
      delete globalThis.CSS;
      expect(cssEscape("a.b#c")).toBe("a.b#c");
    });

    it("returns the value unchanged when CSS.escape is not a function", () => {
      // @ts-expect-error deliberately overriding the API to exercise the fallback
      globalThis.CSS = {};
      expect(cssEscape("a.b#c")).toBe("a.b#c");
    });
  });
});

describe("renderInlineMarkdown", () => {
  it("returns an empty string for falsy input", () => {
    expect(renderInlineMarkdown(undefined)).toBe("");
    expect(renderInlineMarkdown("")).toBe("");
  });

  it("escapes input before applying markdown so raw markup cannot survive", () => {
    expect(renderInlineMarkdown("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("renders code spans", () => {
    expect(renderInlineMarkdown("use `x = 1`")).toBe("use <code>x = 1</code>");
  });

  it("escapes special characters inside code spans", () => {
    expect(renderInlineMarkdown("`a < b`")).toBe("<code>a &lt; b</code>");
  });

  it("renders bold with ** and __", () => {
    expect(renderInlineMarkdown("**a**")).toBe("<strong>a</strong>");
    expect(renderInlineMarkdown("__b__")).toBe("<strong>b</strong>");
  });

  it("renders italic with * and _", () => {
    expect(renderInlineMarkdown("*a*")).toBe("<em>a</em>");
    expect(renderInlineMarkdown("_b_")).toBe("<em>b</em>");
  });

  it("keeps http and https link targets", () => {
    expect(renderInlineMarkdown("[docs](https://example.com)")).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener">docs</a>',
    );
    expect(renderInlineMarkdown("[docs](http://example.com)")).toBe(
      '<a href="http://example.com" target="_blank" rel="noopener">docs</a>',
    );
  });

  it("degrades non-http(s) link targets to their label", () => {
    expect(renderInlineMarkdown("[click](javascript:alert)")).toBe("click");
    expect(renderInlineMarkdown("[img](data:text/html,x)")).toBe("img");
    expect(renderInlineMarkdown("[rel](/relative/path)")).toBe("rel");
  });

  it("combines multiple markdown constructs", () => {
    expect(renderInlineMarkdown("**bold** and *italic* and `code`")).toBe(
      "<strong>bold</strong> and <em>italic</em> and <code>code</code>",
    );
  });
});
