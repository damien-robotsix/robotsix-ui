import { describe, it, expect, beforeEach, vi } from "vitest";
import { collectConfigValues, diffConfigValues } from "./collect.js";
import {
  clearFieldErrors,
  hasAdvancedFields,
  renderConfigForm,
  setAdvancedVisible,
  showFieldError,
} from "./render.js";
import type { ConfigSchema } from "./types.js";

const schema: ConfigSchema = {
  type: "object",
  properties: {
    log_level: { type: "string", enum: ["info", "debug"], default: "info" },
    workers: { type: "integer", default: 4, advanced: true },
    enabled: { type: "boolean", default: true },
    tags: { type: "array", items: { type: "string" }, default: [] },
    api_key: { type: "string", format: "password", writeOnly: true },
    image: { type: "string", "x-deploy-plane": "deploy" },
    imap: {
      type: "object",
      description: "Mailbox connection",
      properties: {
        host: { type: "string", default: "localhost" },
        port: { type: "integer", default: 993 },
      },
    },
  },
};

let container: HTMLElement;

function field(key: string): HTMLInputElement | HTMLSelectElement {
  const el = container.querySelector(`[data-key="${key}"]`);
  if (!el) throw new Error(`no field rendered for ${key}`);
  return el as HTMLInputElement | HTMLSelectElement;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

describe("renderConfigForm", () => {
  it("renders a typed input per schema type", () => {
    renderConfigForm(container, schema, {});

    expect(field("log_level").tagName).toBe("SELECT");
    expect(field("log_level").value).toBe("info");
    expect((field("workers") as HTMLInputElement).type).toBe("number");
    expect((field("enabled") as HTMLInputElement).type).toBe("checkbox");
    expect((field("enabled") as HTMLInputElement).checked).toBe(true);
    expect((field("api_key") as HTMLInputElement).type).toBe("password");
  });

  it("prefers the current value over the schema default", () => {
    renderConfigForm(container, schema, { log_level: "debug", imap: { port: 143 } });

    expect(field("log_level").value).toBe("debug");
    expect(field("imap.port").value).toBe("143");
    // Untouched sibling still falls back to its default.
    expect(field("imap.host").value).toBe("localhost");
  });

  it("groups nested objects into their own section", () => {
    renderConfigForm(container, schema, {});

    const section = container.querySelector(".rsu-config-section:not(.rsu-config-array)");
    expect(section).not.toBeNull();
    const titles = [...container.querySelectorAll(".rsu-config-section-title")].map(
      (el) => el.textContent,
    );
    expect(titles).toContain("General");
    expect(titles).toContain("imap");
  });

  it("never echoes a secret and badges whether one is set", () => {
    renderConfigForm(container, schema, { api_key: "**********" });

    const input = field("api_key") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input.placeholder).toContain("already set");
    const row = input.closest(".rsu-config-row");
    expect(row?.querySelector(".rsu-badge")?.textContent).toBe("set");
  });

  it("badges an unset secret", () => {
    renderConfigForm(container, schema, {});
    const row = field("api_key").closest(".rsu-config-row");
    expect(row?.querySelector(".rsu-badge")?.textContent).toBe("not set");
  });

  it("hides advanced fields until they are revealed", () => {
    renderConfigForm(container, schema, {});

    expect(hasAdvancedFields(container)).toBe(true);
    const row = field("workers").closest(".rsu-config-row") as HTMLElement;
    expect(row.hidden).toBe(true);

    setAdvancedVisible(container, true);
    expect(row.hidden).toBe(false);
  });

  it("disables fields owned by the other plane", () => {
    renderConfigForm(container, schema, { image: "ghcr.io/org/repo:v1" });

    expect((field("image") as HTMLInputElement).disabled).toBe(true);
    expect(
      field("image").closest(".rsu-config-row")?.classList.contains("rsu-config-foreign"),
    ).toBe(true);
    // …and enables them when rendering for the deploy plane instead.
    renderConfigForm(container, schema, {}, { plane: "deploy" });
    expect((field("image") as HTMLInputElement).disabled).toBe(false);
    expect((field("log_level") as HTMLSelectElement).disabled).toBe(true);
  });

  it("edits a plain list as JSON", () => {
    renderConfigForm(container, schema, { tags: ["a", "b"] });
    expect(field("tags").value).toBe('["a","b"]');
  });

  it("notifies the host when a field changes", () => {
    const onChange = vi.fn();
    renderConfigForm(container, schema, {}, { onChange });

    field("log_level").dispatchEvent(new Event("change"));
    expect(onChange).toHaveBeenCalled();
  });

  it("escapes description markup rather than injecting it", () => {
    renderConfigForm(
      container,
      { type: "object", properties: { a: { type: "string", description: "<img onerror=x>" } } },
      {},
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".rsu-config-help")?.textContent).toContain("<img onerror=x>");
  });
});

describe("array sections", () => {
  const arraySchema: ConfigSchema = {
    type: "object",
    properties: {
      accounts: {
        type: "array",
        items: { $ref: "#/$defs/Account" },
      },
    },
    $defs: {
      Account: {
        type: "object",
        properties: {
          id: { type: "string" },
          host: { type: "string", default: "imap.example.com" },
        },
      },
    },
  };

  it("renders one repeatable item per entry", () => {
    renderConfigForm(container, arraySchema, { accounts: [{ id: "work" }, { id: "home" }] });

    expect(container.querySelectorAll(".rsu-config-array-item")).toHaveLength(2);
    expect(field("accounts.0.id").value).toBe("work");
    expect(field("accounts.1.id").value).toBe("home");
  });

  it("adds and removes items, keeping indices contiguous", () => {
    renderConfigForm(container, arraySchema, { accounts: [{ id: "work" }] });

    (container.querySelector(".rsu-config-array-add") as HTMLButtonElement).click();
    expect(container.querySelectorAll(".rsu-config-array-item")).toHaveLength(2);
    field("accounts.1.id").value = "home";

    // Removing the first item renumbers the second down to index 0.
    (container.querySelector(".rsu-config-array-remove") as HTMLButtonElement).click();
    expect(container.querySelectorAll(".rsu-config-array-item")).toHaveLength(1);
    expect(field("accounts.0.id").value).toBe("home");
  });

  it("collects items back into a list", () => {
    renderConfigForm(container, arraySchema, { accounts: [{ id: "work" }] });
    const collected = collectConfigValues(arraySchema, container);
    expect(collected.accounts).toEqual([{ id: "work", host: "imap.example.com" }]);
  });
});

describe("field errors", () => {
  it("places a validation message on the offending row", () => {
    renderConfigForm(container, schema, {});

    expect(showFieldError(container, "imap.port", "must be >= 1")).toBe(true);
    const row = field("imap.port").closest(".rsu-config-row");
    expect(row?.classList.contains("rsu-config-row--invalid")).toBe(true);
    expect(row?.querySelector(".rsu-config-error")?.textContent).toBe("must be >= 1");

    clearFieldErrors(container);
    expect(container.querySelector(".rsu-config-error")).toBeNull();
  });

  it("reports when no row owns the key", () => {
    renderConfigForm(container, schema, {});
    expect(showFieldError(container, "nope", "boom")).toBe(false);
  });
});

describe("collectConfigValues", () => {
  it("coerces each control back to its schema type", () => {
    renderConfigForm(container, schema, {});
    (field("workers") as HTMLInputElement).value = "8";
    (field("enabled") as HTMLInputElement).checked = false;
    field("log_level").value = "debug";

    const collected = collectConfigValues(schema, container);
    expect(collected.workers).toBe(8);
    expect(collected.enabled).toBe(false);
    expect(collected.log_level).toBe("debug");
    expect(collected.imap).toEqual({ host: "localhost", port: 993 });
  });

  it("omits a blank secret so the stored value survives", () => {
    renderConfigForm(container, schema, { api_key: "**********" });
    expect(collectConfigValues(schema, container)).not.toHaveProperty("api_key");

    (field("api_key") as HTMLInputElement).value = "new-secret";
    expect(collectConfigValues(schema, container).api_key).toBe("new-secret");
  });

  it("never collects fields owned by the other plane", () => {
    renderConfigForm(container, schema, { image: "ghcr.io/org/repo:v1" });
    expect(collectConfigValues(schema, container)).not.toHaveProperty("image");
  });

  it("keeps the stored list when the JSON is unparseable", () => {
    renderConfigForm(container, schema, { tags: ["a"] });
    field("tags").value = "[not json";
    expect(collectConfigValues(schema, container)).not.toHaveProperty("tags");
  });
});

describe("diffConfigValues", () => {
  it("returns only the keys whose value changed", () => {
    const before = { a: 1, b: "x", nested: { c: true, d: 2 } };
    const after = { a: 1, b: "y", nested: { c: true, d: 3 } };
    expect(diffConfigValues(before, after)).toEqual({ b: "y", nested: { d: 3 } });
  });

  it("treats a key absent from the update as unchanged", () => {
    expect(diffConfigValues({ a: 1, secret: "kept" }, { a: 1 })).toEqual({});
  });

  it("compares lists by value", () => {
    expect(diffConfigValues({ tags: ["a"] }, { tags: ["a"] })).toEqual({});
    expect(diffConfigValues({ tags: ["a"] }, { tags: ["a", "b"] })).toEqual({ tags: ["a", "b"] });
  });
});
