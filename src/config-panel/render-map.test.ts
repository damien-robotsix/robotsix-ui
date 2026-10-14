/**
 * Unit tests for the open-ended map section builder, isolated from the full
 * `renderConfigForm` pipeline (whose integration coverage lives in map.test.ts).
 *
 * These call `buildMapSection` directly with a hand-built {@link RenderContext}
 * so entry rendering, add/remove wiring, key re-stamping on rename and the
 * componentId auto-derivation are each exercised on their own.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildMapSection } from "./render-map.js";
import type { RenderContext } from "./section-state.js";
import type { JsonSchemaNode } from "./types.js";

const objectValueSchema: JsonSchemaNode = {
  type: "object",
  properties: {
    public_key: { type: "string" },
    project_id: { type: "string" },
  },
};

const objectMapNode: JsonSchemaNode = {
  type: "object",
  description: "project name → credentials",
  additionalProperties: objectValueSchema,
};

const scalarValueSchema: JsonSchemaNode = { type: "string" };
const scalarMapNode: JsonSchemaNode = {
  type: "object",
  additionalProperties: scalarValueSchema,
};

let container: HTMLElement;

function ctx(overrides: Partial<RenderContext> = {}): RenderContext {
  return { plane: "component", defs: undefined, ...overrides };
}

function mount(section: HTMLElement): void {
  container.appendChild(section);
}

function field(key: string): HTMLInputElement {
  const el = container.querySelector(`[data-key="${CSS.escape(key)}"]`);
  if (!el) throw new Error(`no field rendered for ${key}`);
  return el as HTMLInputElement;
}

function nameInput(index = 0): HTMLInputElement {
  return container.querySelectorAll<HTMLInputElement>(".rsu-config-map-name")[index];
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  sessionStorage.clear();
});

describe("buildMapSection — rendering", () => {
  it("tags the section with the map key and renders one entry per key", () => {
    const section = buildMapSection(
      "projects",
      "langfuse.projects",
      objectMapNode,
      objectValueSchema,
      { p1: { public_key: "pk1", project_id: "cm1" } },
      ctx(),
    );
    mount(section);

    expect(section.dataset.mapKey).toBe("langfuse.projects");
    expect(container.querySelectorAll(".rsu-config-map-entry")).toHaveLength(1);
    expect(nameInput().value).toBe("p1");
    expect(field("langfuse.projects.p1.public_key").value).toBe("pk1");
    expect(field("langfuse.projects.p1.project_id").value).toBe("cm1");
  });

  it("renders a scalar-valued entry as a single value row", () => {
    const section = buildMapSection(
      "keys",
      "openrouter.keys",
      scalarMapNode,
      scalarValueSchema,
      { alias: "v1" },
      ctx(),
    );
    mount(section);

    expect(field("openrouter.keys.alias").value).toBe("v1");
  });

  it("renders no entries for a non-object current value", () => {
    const section = buildMapSection(
      "keys",
      "k",
      scalarMapNode,
      scalarValueSchema,
      undefined,
      ctx(),
    );
    mount(section);

    expect(container.querySelectorAll(".rsu-config-map-entry")).toHaveLength(0);
  });
});

describe("buildMapSection — add and remove", () => {
  it("appends a blank entry and notifies the host on add", () => {
    const onChange = vi.fn();
    const section = buildMapSection(
      "keys",
      "k",
      scalarMapNode,
      scalarValueSchema,
      {},
      ctx({ onChange }),
    );
    mount(section);

    (section.querySelector(".rsu-config-map-add") as HTMLButtonElement).click();

    expect(container.querySelectorAll(".rsu-config-map-entry")).toHaveLength(1);
    expect(nameInput().value).toBe("");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("removes an entry and notifies the host", () => {
    const onChange = vi.fn();
    const section = buildMapSection(
      "keys",
      "k",
      scalarMapNode,
      scalarValueSchema,
      { a: "1", b: "2" },
      ctx({ onChange }),
    );
    mount(section);

    (container.querySelectorAll(".rsu-config-array-remove")[0] as HTMLButtonElement).click();

    expect(container.querySelectorAll(".rsu-config-map-entry")).toHaveLength(1);
    expect(nameInput().value).toBe("b");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("buildMapSection — key re-stamping on rename", () => {
  it("re-stamps every field path below a renamed entry", () => {
    const onChange = vi.fn();
    const section = buildMapSection(
      "projects",
      "langfuse.projects",
      objectMapNode,
      objectValueSchema,
      { old: { public_key: "pk1", project_id: "cm1" } },
      ctx({ onChange }),
    );
    mount(section);

    const name = nameInput();
    name.value = "renamed";
    name.dispatchEvent(new Event("input"));

    expect(field("langfuse.projects.renamed.public_key").value).toBe("pk1");
    expect(field("langfuse.projects.renamed.project_id").value).toBe("cm1");
    expect(container.querySelector('[data-key="langfuse.projects.old.public_key"]')).toBeNull();
    expect(onChange).toHaveBeenCalled();
  });

  it("splices a dotted new name verbatim into the field path", () => {
    const section = buildMapSection(
      "projects",
      "langfuse.projects",
      objectMapNode,
      objectValueSchema,
      { old: { public_key: "pk1" } },
      ctx(),
    );
    mount(section);

    const name = nameInput();
    name.value = "a.b";
    name.dispatchEvent(new Event("input"));

    // The entry name occupies exactly one logical segment; a dotted name is
    // spliced in as-is, so the tail still trails it.
    expect(field("langfuse.projects.a.b.public_key").value).toBe("pk1");
  });

  it("does nothing when the name input is unchanged", () => {
    const onChange = vi.fn();
    const section = buildMapSection(
      "projects",
      "langfuse.projects",
      objectMapNode,
      objectValueSchema,
      { same: { public_key: "pk1" } },
      ctx({ onChange }),
    );
    mount(section);

    const name = nameInput();
    name.value = "same";
    name.dispatchEvent(new Event("input"));

    expect(onChange).not.toHaveBeenCalled();
    expect(field("langfuse.projects.same.public_key").value).toBe("pk1");
  });
});

describe("buildMapSection — componentId derivation", () => {
  it("renders the key read-only and defaults a new entry to the componentId", () => {
    const section = buildMapSection(
      "projects",
      "langfuse.projects",
      objectMapNode,
      objectValueSchema,
      {},
      ctx({ componentId: "my-comp" }),
    );
    mount(section);

    (section.querySelector(".rsu-config-map-add") as HTMLButtonElement).click();

    const nameEl = container.querySelector(".rsu-config-map-name") as HTMLElement;
    expect(nameEl.tagName).toBe("SPAN");
    expect(nameEl.textContent).toBe("my-comp");
  });

  it("auto-populates project_id from the componentId in an object-valued entry", () => {
    const section = buildMapSection(
      "projects",
      "langfuse.projects",
      objectMapNode,
      objectValueSchema,
      { existing: { public_key: "pk1", project_id: "stored" } },
      ctx({ componentId: "my-comp" }),
    );
    mount(section);

    // The stored project_id is overridden by the derived componentId.
    expect(field("langfuse.projects.existing.project_id").value).toBe("my-comp");
    // A derived key is shown as read-only text, not an editable input.
    const nameEl = container.querySelector(".rsu-config-map-name") as HTMLElement;
    expect(nameEl.tagName).toBe("SPAN");
  });
});
