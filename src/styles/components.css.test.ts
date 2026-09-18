/// <reference types="node" />
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const STYLESHEET_PATH = "src/styles/components.css";
const CONTRACT_TEST_FILE = "src/styles/components.css.test.ts";

/** Storage-key prefix (`rsu-config:section:` in section-state.ts), not a class. */
const STORAGE_KEY_PREFIX = "rsu-config";

/** Static class tokens; prefix tokens (ending in `-`) are captured separately. */
const RSU_TOKEN_RE = /rsu-[a-z0-9-]+/g;
/** Selector classes only — `var(--rsu-*)` design-token references are excluded. */
const CSS_CLASS_RE = /\.rsu-[a-z0-9-]+/g;

/**
 * `.rsu-*` selectors in `src/styles/components.css` that are intentionally
 * never referenced from TypeScript source or tests. These are public
 * placeholder classes for components that ship later; each is marked with a
 * "placeholder — extend as components ship" comment in the stylesheet:
 * - `rsu-card` — shared card component
 * - `rsu-badge--error` — badge tone variant
 * - `rsu-badge--info` — badge tone variant
 * When a component starts using one, remove it from this list (the "no stale
 * entries" assertion below enforces that).
 */
const CSS_ONLY_ALLOWLIST = new Set(["rsu-badge--error", "rsu-badge--info", "rsu-card"]);

/**
 * Static `rsu-*` classes applied in non-test TypeScript source that
 * intentionally have no companion selector in `src/styles/components.css`.
 * They are unstyled structural hooks: composition markers layered onto a
 * styled base class (`rsu-btn`, `rsu-config-array-item`), DOM hooks used only
 * by `querySelector`/collection logic, or state modifiers that ship no
 * styling yet.
 *
 * Add a class here only when it is a styling-free structural hook; when it
 * gains a real selector, remove it from this list (the "no stale entries"
 * assertion below enforces that).
 */
const TS_ONLY_ALLOWLIST = new Set([
  // app shell: nav-link label span
  "rsu-appshell-label",
  // array renderer containers and controls
  "rsu-config-array",
  "rsu-config-array-add", // styled by `rsu-btn`
  "rsu-config-array-item-body",
  "rsu-config-array-items",
  // form container and save control
  "rsu-config-form",
  "rsu-config-save", // styled by `rsu-btn`
  // map renderer containers and controls
  "rsu-config-map",
  "rsu-config-map-add", // styled by `rsu-btn`
  "rsu-config-map-entries",
  "rsu-config-map-entry", // composed with styled `rsu-config-array-item`
  "rsu-config-map-entry-header", // composed with styled `rsu-config-array-item-header`
  // collapsible-section state modifier
  "rsu-config-section--collapsible",
  // existing drift (audit css_class_contract_sync): applied in panel.ts but
  // has no companion selector yet — prefer adding one to removing this entry
  "rsu-config-tabpanel",
]);

interface RsuTokens {
  /** Complete class-name tokens (never end with `-`). */
  complete: Set<string>;
  /** Dynamic prefixes (end with `-`), e.g. `rsu-config-banner--${tone}`. */
  prefixes: Set<string>;
}

function extractRsuTokens(source: string): RsuTokens {
  const complete = new Set<string>();
  const prefixes = new Set<string>();
  for (const match of source.matchAll(RSU_TOKEN_RE)) {
    const token = match[0];
    if (token === STORAGE_KEY_PREFIX) continue;
    if (token.endsWith("-")) prefixes.add(token);
    else complete.add(token);
  }
  return { complete, prefixes };
}

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function tokensOf(files: string[]): RsuTokens {
  const complete = new Set<string>();
  const prefixes = new Set<string>();
  for (const file of files) {
    const tokens = extractRsuTokens(readFileSync(file, "utf8"));
    for (const token of tokens.complete) complete.add(token);
    for (const token of tokens.prefixes) prefixes.add(token);
  }
  return { complete, prefixes };
}

const allTsFiles = collectTsFiles("src").filter((file) => file !== CONTRACT_TEST_FILE);
const sourceFiles = allTsFiles.filter((file) => !/\.test\.(ts|tsx)$/.test(file));
const testFiles = allTsFiles.filter((file) => /\.test\.(ts|tsx)$/.test(file));

const sourceTokens = tokensOf(sourceFiles);
const testTokens = tokensOf(testFiles);
const cssText = readFileSync(STYLESHEET_PATH, "utf8");
const cssClasses = new Set<string>(
  [...cssText.matchAll(CSS_CLASS_RE)].map((match) => match[0].slice(1)),
);

/** Classes referenced anywhere in TS source or tests, plus dynamic-prefix coverage. */
const referencedInTs = new Set<string>([...sourceTokens.complete, ...testTokens.complete]);
for (const cssClass of cssClasses) {
  if ([...sourceTokens.prefixes].some((prefix) => cssClass.startsWith(prefix))) {
    referencedInTs.add(cssClass);
  }
}

describe("rsu-* class contract between TypeScript and styles", () => {
  it("every static rsu-* class in src/ has a companion selector in components.css", () => {
    const missingSelectors = [...sourceTokens.complete]
      .filter((cssClass) => !cssClasses.has(cssClass) && !TS_ONLY_ALLOWLIST.has(cssClass))
      .sort();
    expect(
      missingSelectors,
      "TS classes without a .rsu-* selector in components.css — add a selector or document them in TS_ONLY_ALLOWLIST",
    ).toEqual([]);
  });

  it("every .rsu-* selector in components.css is referenced from src/", () => {
    const unreferencedSelectors = [...cssClasses]
      .filter((cssClass) => !referencedInTs.has(cssClass) && !CSS_ONLY_ALLOWLIST.has(cssClass))
      .sort();
    expect(
      unreferencedSelectors,
      "components.css selectors never referenced in src/ — remove them or document them in CSS_ONLY_ALLOWLIST",
    ).toEqual([]);
  });

  it("keeps both allowlists free of entries that have since been reconciled", () => {
    const staleTsOnly = [...TS_ONLY_ALLOWLIST]
      .filter((cssClass) => cssClasses.has(cssClass))
      .sort();
    const staleCssOnly = [...CSS_ONLY_ALLOWLIST]
      .filter((cssClass) => referencedInTs.has(cssClass))
      .sort();
    expect(
      staleTsOnly,
      "these TS_ONLY_ALLOWLIST entries now have a selector — remove them from the allowlist",
    ).toEqual([]);
    expect(
      staleCssOnly,
      "these CSS_ONLY_ALLOWLIST entries are now referenced — remove them from the allowlist",
    ).toEqual([]);
  });
});
