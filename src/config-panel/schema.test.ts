import { describe, it, expect } from "vitest";
import {
  arrayItemObject,
  ensureJsonSchema,
  fieldPlane,
  isSecretField,
  resolveRef,
  setNestedValue,
} from "./schema.js";

describe("resolveRef", () => {
  const defs = {
    ImapConfig: {
      type: "object",
      properties: { host: { type: "string" } },
    },
  };

  it("resolves a $ref into $defs", () => {
    const resolved = resolveRef({ $ref: "#/$defs/ImapConfig" }, defs);
    expect(resolved.properties?.host).toEqual({ type: "string" });
  });

  it("propagates field-level extras onto the resolved definition", () => {
    const resolved = resolveRef(
      { $ref: "#/$defs/ImapConfig", group: "LLM / OpenRouter", description: "Mailbox" },
      defs,
    );
    expect(resolved.group).toBe("LLM / OpenRouter");
    expect(resolved.description).toBe("Mailbox");
    // The definition itself is not mutated.
    expect(defs.ImapConfig).not.toHaveProperty("group");
  });

  it("unwraps a nullable union to its single non-null branch", () => {
    const resolved = resolveRef(
      { anyOf: [{ $ref: "#/$defs/ImapConfig" }, { type: "null" }], group: "LLM / OpenRouter" },
      defs,
    );
    expect(resolved.type).toBe("object");
    expect(resolved.group).toBe("LLM / OpenRouter");
  });

  it("leaves a genuine multi-branch union alone", () => {
    const union = { anyOf: [{ type: "string" }, { type: "integer" }] };
    expect(resolveRef(union, defs)).toBe(union);
  });

  it("returns the node unchanged when there is nothing to resolve", () => {
    const node = { type: "string" };
    expect(resolveRef(node, defs)).toBe(node);
  });
});

describe("isSecretField", () => {
  it("is true only for the typed SecretStr reflection", () => {
    expect(isSecretField({ type: "string", format: "password", writeOnly: true })).toBe(true);
    expect(isSecretField({ type: "string", format: "password" })).toBe(false);
    // Never guessed from the field's name.
    expect(isSecretField({ type: "string" })).toBe(false);
  });
});

describe("fieldPlane", () => {
  it("defaults to component ownership", () => {
    expect(fieldPlane({ type: "string" })).toBe("component");
    expect(fieldPlane({ type: "string", "x-deploy-plane": "deploy" })).toBe("deploy");
  });
});

describe("arrayItemObject", () => {
  it("returns the item schema for an array of objects", () => {
    const defs = { Account: { type: "object", properties: { id: { type: "string" } } } };
    const node = { type: "array", items: { $ref: "#/$defs/Account" } };
    expect(arrayItemObject(node, defs)?.properties?.id).toEqual({ type: "string" });
  });

  it("returns null for a list of scalars", () => {
    expect(arrayItemObject({ type: "array", items: { type: "string" } }, {})).toBeNull();
    expect(arrayItemObject({ type: "string" }, {})).toBeNull();
  });
});

describe("ensureJsonSchema", () => {
  it("passes a real JSON Schema through", () => {
    const schema = { type: "object", properties: { a: { type: "string" } } };
    expect(ensureJsonSchema(schema)).toBe(schema);
  });

  it("converts a legacy value template, including the SECRET sentinel", () => {
    const converted = ensureJsonSchema({
      host: "localhost",
      port: 8080,
      debug: true,
      password: "SECRET",
      nested: { a: 1.5 },
    });
    expect(converted.properties?.host).toEqual({ type: "string", default: "localhost" });
    expect(converted.properties?.port).toEqual({ type: "integer", default: 8080 });
    expect(converted.properties?.debug).toEqual({ type: "boolean", default: true });
    expect(converted.properties?.password).toEqual({
      type: "string",
      format: "password",
      writeOnly: true,
    });
    expect(converted.properties?.nested?.properties?.a).toEqual({ type: "number", default: 1.5 });
  });
});

describe("setNestedValue", () => {
  it("creates intermediate objects and arrays from a dotted path", () => {
    const target: Record<string, unknown> = {};
    setNestedValue(target, "accounts.0.auth.username", "bot");
    expect(target).toEqual({ accounts: [{ auth: { username: "bot" } }] });
  });
});
