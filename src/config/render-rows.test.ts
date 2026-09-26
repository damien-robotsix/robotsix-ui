import { describe, it, expect, vi } from "vitest";
import { buildRow } from "./render-rows.js";
import type { RenderContext } from "./section-state.js";
import type { JsonSchemaNode } from "./types.js";

function ctx(overrides: Partial<RenderContext> = {}): RenderContext {
  return { plane: "component", defs: undefined, ...overrides };
}

function input(row: HTMLElement): HTMLInputElement {
  return row.querySelector("[data-key]") as HTMLInputElement;
}

describe("buildRow", () => {
  it("wraps every field in a config row", () => {
    const row = buildRow("workers", "workers", { type: "integer" }, undefined, [], ctx());
    expect(row.className).toBe("rsu-config-row");
  });

  it("routes an enum node to a select", () => {
    const row = buildRow(
      "log_level",
      "log_level",
      { type: "string", enum: ["info", "debug"] },
      undefined,
      [],
      ctx(),
    );
    expect(row.querySelector("select")).not.toBeNull();
  });

  it("routes integer and number nodes to a number input", () => {
    const intRow = buildRow("workers", "workers", { type: "integer" }, undefined, [], ctx());
    const numRow = buildRow("ratio", "ratio", { type: "number" }, undefined, [], ctx());
    expect(input(intRow).type).toBe("number");
    expect(input(numRow).type).toBe("number");
  });

  it("routes a boolean node to a checkbox", () => {
    const row = buildRow("enabled", "enabled", { type: "boolean" }, undefined, [], ctx());
    expect(input(row).type).toBe("checkbox");
  });

  it("routes a secret node to a masked password input", () => {
    const row = buildRow(
      "api_key",
      "api_key",
      { type: "string", format: "password", writeOnly: true },
      undefined,
      [],
      ctx(),
    );
    expect(input(row).type).toBe("password");
    expect(input(row).getAttribute("data-secret")).toBe("1");
  });

  it("routes an array node to a JSON list input", () => {
    const row = buildRow("tags", "tags", { type: "array" }, undefined, [], ctx());
    expect(input(row).getAttribute("data-json")).toBe("1");
  });

  it("routes a non-array node with an array value to a JSON list input", () => {
    const row = buildRow("tags", "tags", { type: "string" }, ["a", "b"], [], ctx());
    expect(input(row).getAttribute("data-json")).toBe("1");
    expect(input(row).value).toBe('["a","b"]');
  });

  it("falls back to a text input for a plain string", () => {
    const row = buildRow("name", "name", { type: "string" }, "hi", [], ctx());
    expect(input(row).type).toBe("text");
    expect(input(row).value).toBe("hi");
  });

  it("marks required fields with an asterisk", () => {
    const row = buildRow("name", "name", { type: "string" }, undefined, ["name"], ctx());
    expect(row.querySelector(".rsu-config-key")?.textContent).toBe("name *");
  });

  it("omits the asterisk for optional fields", () => {
    const row = buildRow("name", "name", { type: "string" }, undefined, [], ctx());
    expect(row.querySelector(".rsu-config-key")?.textContent).toBe("name");
  });

  it("renders the description as help text and a tooltip", () => {
    const row = buildRow(
      "name",
      "name",
      { type: "string", description: "the display name" },
      undefined,
      [],
      ctx(),
    );
    expect(row.querySelector(".rsu-config-help")?.textContent).toContain("the display name");
    const title = row.querySelector(".rsu-config-key")?.getAttribute("title");
    expect(title).toContain("the display name");
    expect(title).toContain("(name)");
  });

  it("uses the full dotted key as the tooltip when it differs and there is no description", () => {
    const row = buildRow("imap.host", "host", { type: "string" }, undefined, [], ctx());
    expect(row.querySelector(".rsu-config-key")?.getAttribute("title")).toBe("imap.host");
  });

  it("omits the tooltip for a top-level field with no description", () => {
    const row = buildRow("host", "host", { type: "string" }, undefined, [], ctx());
    expect(row.querySelector(".rsu-config-key")?.getAttribute("title")).toBeNull();
  });

  it("escapes markup in the description help rather than injecting it", () => {
    const row = buildRow(
      "name",
      "name",
      { type: "string", description: "<img onerror=x>" },
      undefined,
      [],
      ctx(),
    );
    expect(row.querySelector("img")).toBeNull();
    expect(row.querySelector(".rsu-config-help")?.textContent).toContain("<img onerror=x>");
  });

  it("resolves a $ref before choosing the row type", () => {
    const defs: Record<string, JsonSchemaNode> = { Level: { type: "string", enum: ["a", "b"] } };
    const row = buildRow(
      "level",
      "level",
      { $ref: "#/$defs/Level" },
      undefined,
      [],
      ctx({ defs }),
    );
    expect(row.querySelector("select")).not.toBeNull();
  });

  it("disables a field owned by the other plane and flags the row foreign", () => {
    const row = buildRow(
      "image",
      "image",
      { type: "string", "x-deploy-plane": "deploy" },
      undefined,
      [],
      ctx({ plane: "component" }),
    );
    expect(input(row).disabled).toBe(true);
    expect(row.classList.contains("rsu-config-foreign")).toBe(true);
  });

  it("leaves an owned field enabled", () => {
    const row = buildRow("name", "name", { type: "string" }, undefined, [], ctx());
    expect(input(row).disabled).toBe(false);
    expect(row.classList.contains("rsu-config-foreign")).toBe(false);
  });
});

describe("buildSecretRow", () => {
  it("never echoes the stored value and badges an already-set secret", () => {
    const row = buildRow(
      "api_key",
      "api_key",
      { type: "string", format: "password", writeOnly: true },
      "s3cr3t",
      [],
      ctx(),
    );
    expect(input(row).value).toBe("");
    expect(input(row).placeholder).toContain("already set");
    expect(input(row).autocomplete).toBe("off");
    const badge = row.querySelector(".rsu-badge");
    expect(badge?.textContent).toBe("set");
    expect(badge?.classList.contains("rsu-badge--success")).toBe(true);
  });

  it("badges an unset secret", () => {
    const row = buildRow(
      "api_key",
      "api_key",
      { type: "string", format: "password", writeOnly: true },
      undefined,
      [],
      ctx(),
    );
    expect(input(row).placeholder).toContain("not set");
    const badge = row.querySelector(".rsu-badge");
    expect(badge?.textContent).toBe("not set");
    expect(badge?.classList.contains("rsu-badge--warning")).toBe(true);
  });

  it("treats an empty-string value as not set", () => {
    const row = buildRow(
      "api_key",
      "api_key",
      { type: "string", format: "password", writeOnly: true },
      "",
      [],
      ctx(),
    );
    expect(row.querySelector(".rsu-badge")?.textContent).toBe("not set");
  });
});

describe("buildJsonListRow", () => {
  it("serialises the current list value as JSON", () => {
    const row = buildRow("tags", "tags", { type: "array" }, ["x", "y"], [], ctx());
    expect(input(row).value).toBe('["x","y"]');
    expect(row.querySelector(".rsu-config-hint")?.textContent).toBe("JSON list");
  });

  it("renders an empty list when the display value is the empty string", () => {
    const row = buildRow("tags", "tags", { type: "array" }, undefined, [], ctx());
    expect(input(row).value).toBe("[]");
  });

  it("disables spellcheck on the JSON input", () => {
    const row = buildRow("tags", "tags", { type: "array" }, [], [], ctx());
    expect(input(row).getAttribute("spellcheck")).toBe("false");
  });
});

describe("buildSelectRow", () => {
  it("renders one option per enum member and selects the current value", () => {
    const row = buildRow(
      "log_level",
      "log_level",
      { type: "string", enum: ["info", "debug", "warn"] },
      "debug",
      [],
      ctx(),
    );
    const options = [...row.querySelectorAll("option")];
    expect(options.map((o) => o.value)).toEqual(["info", "debug", "warn"]);
    expect((row.querySelector("select") as HTMLSelectElement).value).toBe("debug");
  });

  it("falls back to the schema default when there is no current value", () => {
    const row = buildRow(
      "log_level",
      "log_level",
      { type: "string", enum: ["info", "debug"], default: "info" },
      undefined,
      [],
      ctx(),
    );
    expect((row.querySelector("select") as HTMLSelectElement).value).toBe("info");
  });
});

describe("buildNumberRow", () => {
  it("adds an integer step for integer nodes", () => {
    const row = buildRow("workers", "workers", { type: "integer", default: 4 }, undefined, [], ctx());
    expect(input(row).getAttribute("step")).toBe("1");
    expect(input(row).value).toBe("4");
  });

  it("omits the step for float number nodes", () => {
    const row = buildRow("ratio", "ratio", { type: "number" }, 1.5, [], ctx());
    expect(input(row).getAttribute("step")).toBeNull();
    expect(input(row).value).toBe("1.5");
  });
});

describe("buildBooleanRow", () => {
  it("checks the box for truthy display values", () => {
    for (const val of [true, "true", 1]) {
      const row = buildRow("enabled", "enabled", { type: "boolean" }, val, [], ctx());
      expect(input(row).checked).toBe(true);
    }
  });

  it("leaves the box unchecked for falsy display values", () => {
    for (const val of [false, "false", 0]) {
      const row = buildRow("enabled", "enabled", { type: "boolean" }, val, [], ctx());
      expect(input(row).checked).toBe(false);
    }
  });

  it("uses the schema default when there is no current value", () => {
    const row = buildRow("enabled", "enabled", { type: "boolean", default: true }, undefined, [], ctx());
    expect(input(row).checked).toBe(true);
  });
});

describe("buildTextRow", () => {
  it("renders the display value in a text input", () => {
    const row = buildRow("name", "name", { type: "string", default: "bot" }, undefined, [], ctx());
    expect(input(row).type).toBe("text");
    expect(input(row).value).toBe("bot");
  });

  it("escapes the value into the attribute rather than breaking out of it", () => {
    const row = buildRow("name", "name", { type: "string" }, '"><script>', [], ctx());
    expect(row.querySelector("script")).toBeNull();
    expect(input(row).value).toBe('"><script>');
  });
});

describe("wireRow", () => {
  it("invokes onChange on both change and input events", () => {
    const onChange = vi.fn();
    const row = buildRow("name", "name", { type: "string" }, "", [], ctx({ onChange }));
    input(row).dispatchEvent(new Event("change"));
    input(row).dispatchEvent(new Event("input"));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("wires the select of an enum row", () => {
    const onChange = vi.fn();
    const row = buildRow(
      "log_level",
      "log_level",
      { type: "string", enum: ["a", "b"] },
      undefined,
      [],
      ctx({ onChange }),
    );
    (row.querySelector("select") as HTMLSelectElement).dispatchEvent(new Event("change"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not throw when no onChange is provided", () => {
    const row = buildRow("name", "name", { type: "string" }, "", [], ctx());
    expect(() => input(row).dispatchEvent(new Event("change"))).not.toThrow();
  });
});
