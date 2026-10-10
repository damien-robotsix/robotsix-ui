/**
 * Unit tests for the repeatable array section builder, isolated from the full
 * `renderConfigForm` pipeline (whose integration coverage lives in
 * render.test.ts).
 *
 * These call `buildArraySection` directly with a hand-built
 * {@link RenderContext} so item rendering, heading selection, add wiring and
 * the index re-stamping that follows a removal are each exercised on their own.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildArraySection } from "./render-array.js";
import type { RenderContext } from "./section-state.js";
import type { JsonSchemaNode } from "./types.js";

const itemSchema: JsonSchemaNode = {
  type: "object",
  properties: {
    host: { type: "string" },
    auth: { type: "object", properties: { user: { type: "string" } } },
  },
};

const arrayNode: JsonSchemaNode = { type: "array", items: itemSchema };

let container: HTMLElement;

function ctx(overrides: Partial<RenderContext> = {}): RenderContext {
  return { plane: "component", defs: undefined, ...overrides };
}

function build(currentVal: unknown, overrides: Partial<RenderContext> = {}): HTMLElement {
  const section = buildArraySection(
    "servers",
    "servers",
    arrayNode,
    itemSchema,
    currentVal,
    ctx(overrides),
  );
  container.appendChild(section);
  return section;
}

function items(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".rsu-config-array-item")];
}

function field(key: string): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>(`[data-key="${CSS.escape(key)}"]`);
}

function headings(): (string | null)[] {
  return [...container.querySelectorAll(".rsu-config-array-item-header > span")].map(
    (el) => el.textContent,
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  sessionStorage.clear();
});

describe("buildArraySection — rendering", () => {
  it("tags the section with the array key and renders one item per element", () => {
    const section = build([{ host: "h0" }, { host: "h1" }]);

    expect(section.dataset.arrayKey).toBe("servers");
    expect(items()).toHaveLength(2);
    expect(items()[0].dataset.arrayIndex).toBe("0");
    expect(items()[1].dataset.arrayIndex).toBe("1");
    expect(items()[0].dataset.arrayPrefix).toBe("servers");
    expect(field("servers.0.host")?.value).toBe("h0");
    expect(field("servers.1.host")?.value).toBe("h1");
  });

  it("renders nested object fields with deep data-key paths", () => {
    build([{ host: "h0", auth: { user: "u0" } }]);
    expect(field("servers.0.auth.user")?.value).toBe("u0");
  });

  it("renders no items for a non-array current value", () => {
    build(undefined);
    expect(items()).toHaveLength(0);
  });

  it("picks the item heading from id/name/email/account_id then falls back", () => {
    build([
      { id: "the-id", name: "n" },
      { name: "the-name" },
      { email: "the-email" },
      { account_id: "the-account" },
      {},
    ]);

    expect(headings()).toEqual(["the-id", "the-name", "the-email", "the-account", "[4]"]);
  });
});

describe("buildArraySection — add", () => {
  it("appends a new item with the next index and notifies the host", () => {
    const onChange = vi.fn();
    const section = build([{ host: "h0" }], { onChange });

    (section.querySelector(".rsu-config-array-add") as HTMLButtonElement).click();

    expect(items()).toHaveLength(2);
    expect(items()[1].dataset.arrayIndex).toBe("1");
    expect(headings()[1]).toBe("[1]");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("buildArraySection — remove and reindex", () => {
  it("renumbers indices and re-stamps field paths after a removal", () => {
    const onChange = vi.fn();
    const section = build(
      [
        { host: "h0", auth: { user: "u0" } },
        { host: "h1", auth: { user: "u1" } },
        { host: "h2", auth: { user: "u2" } },
      ],
      { onChange },
    );

    // Remove the first item.
    (section.querySelectorAll(".rsu-config-array-remove")[0] as HTMLButtonElement).click();

    expect(items()).toHaveLength(2);
    expect(items()[0].dataset.arrayIndex).toBe("0");
    expect(items()[1].dataset.arrayIndex).toBe("1");

    // The survivors slid down one slot; their field paths followed, deep
    // nested keys included.
    expect(field("servers.0.host")?.value).toBe("h1");
    expect(field("servers.0.auth.user")?.value).toBe("u1");
    expect(field("servers.1.host")?.value).toBe("h2");
    expect(field("servers.1.auth.user")?.value).toBe("u2");
    // The old trailing index no longer resolves.
    expect(field("servers.2.host")).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("leaves paths untouched when the removed item was the last one", () => {
    const section = build([{ host: "h0" }, { host: "h1" }]);

    (section.querySelectorAll(".rsu-config-array-remove")[1] as HTMLButtonElement).click();

    expect(items()).toHaveLength(1);
    expect(field("servers.0.host")?.value).toBe("h0");
    expect(field("servers.1.host")).toBeNull();
  });
});
