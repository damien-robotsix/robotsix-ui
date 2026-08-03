/** HTML escaping and the inline-markdown subset used in field help text. */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape a value for interpolation into element content. */
export function escHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Escape a value for interpolation into a double-quoted attribute. */
export function escAttr(value: unknown): string {
  return escHtml(value);
}

/** Escape a value for use in a CSS selector (delegates to CSS.escape). */
export function cssEscape(value: string): string {
  const api = globalThis.CSS;
  return api && typeof api.escape === "function" ? api.escape(value) : value;
}

/**
 * Render the inline-markdown subset used by pydantic field descriptions:
 * `code`, **bold**, *italic* and [links](url).
 *
 * The input is fully escaped first, so no caller-supplied markup can survive.
 * Only `http(s)` link targets are kept — anything else degrades to its label.
 */
export function renderInlineMarkdown(text: string | undefined): string {
  if (!text) return "";
  let s = escHtml(text);
  // Code spans first, so their literal content is not re-processed.
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_]+)_/g, "<em>$1</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) =>
    /^https?:\/\//i.test(url)
      ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>`
      : label,
  );
  return s;
}
