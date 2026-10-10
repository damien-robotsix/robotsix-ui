/**
 * Unit tests for the form collector and diff, isolated from the renderer.
 *
 * Rather than drive the full `renderConfigForm` pipeline (covered by
 * render.test.ts / map.test.ts), these build the minimal DOM the collector
 * queries — typed inputs carrying `data-key`, plus the scoped section shells
 * for arrays and maps — so each coercion, secret, plane and diff rule is
 * exercised on its own.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { collectConfigValues, diffConfigValues } from "./collect.js";
import type { ConfigSchema } from "./types.js";

let container: HTMLElement;

interface InputOpts {
  type?: string;
  value?: string;
  checked?: boolean;
  json?: boolean;
  secret?: boolean;
}

/** Append a typed input carrying `data-key` so the collector can read it. */
function addInput(
  key: string,
  opts: InputOpts = {},
  parent: HTMLElement = container,
): HTMLInputElement {
  const input = document.createElement("input");
  input.dataset.key = key;
  if (opts.type) input.type = opts.type;
  if (opts.json) input.dataset.json = "1";
  if (opts.secret) input.dataset.secret = "1";
  if (opts.checked !== undefined) input.checked = opts.checked;
  if (opts.value !== undefined) input.value = opts.value;
  parent.appendChild(input);
  return input;
}

/** Append a select carrying `data-key`. */
function addSelect(key: string, value: string, options: string[]): HTMLSelectElement {
  const select = document.createElement("select");
  select.dataset.key = key;
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    select.appendChild(o);
  }
  select.value = value;
  container.appendChild(select);
  return select;
}

/** Build the scoped array-section shell the collector walks; return its items div. */
function arraySection(prefix: string): HTMLElement {
  const section = document.createElement("div");
  section.dataset.arrayKey = prefix;
  const body = document.createElement("div");
  body.className = "rsu-config-section-body";
  const items = document.createElement("div");
  items.className = "rsu-config-array-items";
  body.appendChild(items);
  section.appendChild(body);
  container.appendChild(section);
  return items;
}

function arrayItem(items: HTMLElement, index: number): HTMLElement {
  const item = document.createElement("div");
  item.className = "rsu-config-array-item";
  item.dataset.arrayIndex = String(index);
  items.appendChild(item);
  return item;
}

/** Build the scoped map-section shell; return its entries div. */
function mapSection(prefix: string): HTMLElement {
  const section = document.createElement("div");
  section.dataset.mapKey = prefix;
  const body = document.createElement("div");
  body.className = "rsu-config-section-body";
  const entries = document.createElement("div");
  entries.className = "rsu-config-map-entries";
  body.appendChild(entries);
  section.appendChild(body);
  container.appendChild(section);
  return entries;
}

function mapEntry(entries: HTMLElement, name: string): HTMLElement {
  const entry = document.createElement("div");
  entry.className = "rsu-config-map-entry";
  entry.dataset.mapName = name;
  entries.appendChild(entry);
  return entry;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

describe("collectConfigValues — scalar leaves", () => {
  it("collects a text field and omits a blank optional leaf", () => {
    const schema: ConfigSchema = {
      type: "object",
      properties: { name: { type: "string" }, blank: { type: "string" } },
    };
    addInput("name", { type: "text", value: "hello" });
    addInput("blank", { type: "text", value: "" });

    expect(collectConfigValues(schema, container)).toEqual({ name: "hello" });
  });

  it("omits a field that has no rendered input", () => {
    const schema: ConfigSchema = { type: "object", properties: { missing: { type: "string" } } };
    expect(collectConfigValues(schema, container)).toEqual({});
  });

  it("coerces number fields by schema type and omits an empty number", () => {
    const schema: ConfigSchema = {
      type: "object",
      properties: {
        port: { type: "integer" },
        ratio: { type: "number" },
        empty: { type: "integer" },
      },
    };
    addInput("port", { type: "number", value: "42" });
    addInput("ratio", { type: "number", value: "1.5" });
    addInput("empty", { type: "number", value: "" });

    const collected = collectConfigValues(schema, container);
    expect(collected).toEqual({ port: 42, ratio: 1.5 });
    expect(Number.isInteger(collected.port as number)).toBe(true);
  });

  it("reads a checkbox as a boolean, including false", () => {
    const schema: ConfigSchema = {
      type: "object",
      properties: { enabled: { type: "boolean" }, off: { type: "boolean" } },
    };
    addInput("enabled", { type: "checkbox", checked: true });
    addInput("off", { type: "checkbox", checked: false });

    expect(collectConfigValues(schema, container)).toEqual({ enabled: true, off: false });
  });

  it("parses a JSON list field and omits malformed JSON", () => {
    const schema: ConfigSchema = {
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" } },
        broken: { type: "array" },
      },
    };
    addInput("tags", { type: "text", value: '["a","b"]', json: true });
    addInput("broken", { type: "text", value: "[not json", json: true });

    expect(collectConfigValues(schema, container)).toEqual({ tags: ["a", "b"] });
  });

  it("reads a select value", () => {
    const schema: ConfigSchema = {
      type: "object",
      properties: { level: { type: "string", enum: ["info", "debug"] } },
    };
    addSelect("level", "debug", ["info", "debug"]);

    expect(collectConfigValues(schema, container)).toEqual({ level: "debug" });
  });
});

describe("collectConfigValues — secrets and planes", () => {
  it("applies merge-on-write: a blank secret is omitted, a typed one is kept", () => {
    const schema: ConfigSchema = {
      type: "object",
      properties: {
        token: { type: "string", format: "password", writeOnly: true },
        pass: { type: "string", format: "password", writeOnly: true },
      },
    };
    addInput("token", { type: "password", value: "", secret: true });
    addInput("pass", { type: "password", value: "new-secret", secret: true });

    expect(collectConfigValues(schema, container)).toEqual({ pass: "new-secret" });
  });

  it("skips fields owned by the other plane", () => {
    const schema: ConfigSchema = {
      type: "object",
      properties: {
        image: { type: "string", "x-deploy-plane": "deploy" },
        name: { type: "string" },
      },
    };
    addInput("image", { type: "text", value: "ghcr.io/org/repo:v1" });
    addInput("name", { type: "text", value: "svc" });

    // Default (component) plane keeps only its own field…
    expect(collectConfigValues(schema, container)).toEqual({ name: "svc" });
    // …and the deploy plane sees the mirror image.
    expect(collectConfigValues(schema, container, { plane: "deploy" })).toEqual({
      image: "ghcr.io/org/repo:v1",
    });
  });
});

describe("collectConfigValues — nested objects", () => {
  it("collects nested object fields and drops a wholly-empty nested object", () => {
    const schema: ConfigSchema = {
      type: "object",
      properties: {
        imap: {
          type: "object",
          properties: { host: { type: "string" }, port: { type: "integer" } },
        },
        empty: { type: "object", properties: { a: { type: "string" } } },
      },
    };
    addInput("imap.host", { type: "text", value: "localhost" });
    addInput("imap.port", { type: "number", value: "993" });
    addInput("empty.a", { type: "text", value: "" });

    expect(collectConfigValues(schema, container)).toEqual({
      imap: { host: "localhost", port: 993 },
    });
  });
});

describe("collectConfigValues — arrays", () => {
  const schema: ConfigSchema = {
    type: "object",
    properties: {
      servers: {
        type: "array",
        items: {
          type: "object",
          properties: { host: { type: "string" }, port: { type: "integer" } },
        },
      },
    },
  };

  it("collects array items in index order", () => {
    const items = arraySection("servers");
    arrayItem(items, 0);
    arrayItem(items, 1);
    addInput("servers.0.host", { type: "text", value: "h0" });
    addInput("servers.0.port", { type: "number", value: "1" });
    addInput("servers.1.host", { type: "text", value: "h1" });
    addInput("servers.1.port", { type: "number", value: "2" });

    expect(collectConfigValues(schema, container)).toEqual({
      servers: [
        { host: "h0", port: 1 },
        { host: "h1", port: 2 },
      ],
    });
  });

  it("returns an empty array when the section renders no items", () => {
    arraySection("servers");
    expect(collectConfigValues(schema, container)).toEqual({ servers: [] });
  });

  it("omits the key entirely when the array section is absent", () => {
    expect(collectConfigValues(schema, container)).toEqual({});
  });
});

describe("collectConfigValues — maps", () => {
  it("collects object-valued entries and skips a blank-named row", () => {
    const schema: ConfigSchema = {
      type: "object",
      properties: {
        projects: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: { project_id: { type: "string" } },
          },
        },
      },
    };
    const entries = mapSection("projects");
    mapEntry(entries, "p1");
    mapEntry(entries, ""); // half-added row — skipped
    addInput("projects.p1.project_id", { type: "text", value: "cm1" });

    expect(collectConfigValues(schema, container)).toEqual({
      projects: { p1: { project_id: "cm1" } },
    });
  });

  it("keeps a blank scalar entry as an empty string but keeps a typed one", () => {
    const schema: ConfigSchema = {
      type: "object",
      properties: {
        keys: {
          type: "object",
          additionalProperties: { type: "string", format: "password", writeOnly: true },
        },
      },
    };
    const entries = mapSection("keys");
    mapEntry(entries, "alias");
    mapEntry(entries, "alias2");
    addInput("keys.alias", { type: "password", value: "", secret: true });
    addInput("keys.alias2", { type: "password", value: "sk-new", secret: true });

    expect(collectConfigValues(schema, container)).toEqual({
      keys: { alias: "", alias2: "sk-new" },
    });
  });
});

describe("diffConfigValues", () => {
  it("returns only the changed scalar keys", () => {
    expect(diffConfigValues({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({ b: 3 });
  });

  it("includes a brand-new key", () => {
    expect(diffConfigValues({}, { a: 1 })).toEqual({ a: 1 });
  });

  it("recurses into nested objects and keeps only the changed branch", () => {
    expect(
      diffConfigValues({ imap: { host: "h", port: 1 } }, { imap: { host: "h", port: 2 } }),
    ).toEqual({ imap: { port: 2 } });
  });

  it("drops a nested object whose diff is empty", () => {
    expect(diffConfigValues({ a: { b: 1 } }, { a: { b: 1 } })).toEqual({});
  });

  it("uses deep equality for arrays", () => {
    expect(diffConfigValues({ tags: ["a"] }, { tags: ["a"] })).toEqual({});
    expect(diffConfigValues({ tags: ["a"] }, { tags: ["a", "b"] })).toEqual({ tags: ["a", "b"] });
  });

  it("diffs a schema-declared map whole so a removed entry survives", () => {
    const schema: ConfigSchema = {
      type: "object",
      properties: {
        projects: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: { x: { type: "integer" } },
          },
        },
      },
    };
    const current = { projects: { p1: { x: 1 }, p2: { x: 2 } } };
    const next = { projects: { p1: { x: 1 } } };

    // With the schema the map is one value, so dropping p2 is a real change.
    expect(diffConfigValues(current, next, schema)).toEqual({ projects: { p1: { x: 1 } } });
    // Without it the map reads as a nested object and the removal diffs to nothing.
    expect(diffConfigValues(current, next)).toEqual({});
  });
});
