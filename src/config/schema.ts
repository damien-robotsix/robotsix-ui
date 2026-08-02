/** JSON Schema traversal helpers shared by the renderer and the collector. */

import type { ConfigSchema, DeployPlane, JsonSchemaNode } from "./types.js";

/**
 * Annotations that belong to the *field* rather than to the *type definition*.
 *
 * When a pydantic field uses a `$ref` or a nullable union, extras set through
 * `Field(json_schema_extra=…)` sit on the wrapper schema, not on the `$defs`
 * entry — so they must be propagated down when the ref is resolved.
 */
const FIELD_EXTRAS = ["advanced", "description", "default", "title", "x-deploy-plane"] as const;

function propagateExtras(source: JsonSchemaNode, target: JsonSchemaNode): JsonSchemaNode {
  const clone: JsonSchemaNode = { ...target };
  for (const key of FIELD_EXTRAS) {
    const value = source[key];
    if (value !== undefined && clone[key] === undefined) {
      (clone as Record<string, unknown>)[key] = value;
    }
  }
  return clone;
}

/**
 * Resolve a property schema to the node the panel should render.
 *
 * Unwraps `$ref`s into `$defs` and nullable unions (`anyOf`/`oneOf` with
 * exactly one non-null branch, i.e. pydantic's `Optional[X]`).  Without the
 * union unwrap an optional object falls through to a text leaf and emits an
 * invalid `""` that fails the schema on save.  Multi-branch unions are left
 * alone — the panel renders them as text.
 */
export function resolveRef(
  propSchema: JsonSchemaNode | undefined,
  defs: Record<string, JsonSchemaNode> | undefined,
): JsonSchemaNode {
  if (!propSchema) return {};

  const union = propSchema.anyOf || propSchema.oneOf;
  if (Array.isArray(union)) {
    const nonNull = union.filter((branch) => branch && branch.type !== "null");
    if (nonNull.length === 1) {
      return propagateExtras(propSchema, resolveRef(nonNull[0], defs));
    }
    return propSchema;
  }

  if (!propSchema.$ref || !defs) return propSchema;
  const prefix = "#/$defs/";
  if (propSchema.$ref.startsWith(prefix)) {
    const defName = propSchema.$ref.slice(prefix.length);
    const target = defs[defName];
    if (target) return propagateExtras(propSchema, target);
  }
  return propSchema;
}

/**
 * True when a node is a secret field.
 *
 * The convention is pydantic's `SecretStr`, reflected into the schema as
 * `{"format": "password", "writeOnly": true}` (config-standard.md § 3).
 * Secrets are typed, never guessed from the field's name.
 */
export function isSecretField(node: JsonSchemaNode): boolean {
  return node.format === "password" && node.writeOnly === true;
}

/** Which plane owns a field.  Unannotated fields are component-owned. */
export function fieldPlane(node: JsonSchemaNode): DeployPlane {
  return node["x-deploy-plane"] || "component";
}

/** True when a node renders as its own section rather than a single row. */
export function isObjectNode(node: JsonSchemaNode): boolean {
  return node.type === "object" && node.properties !== undefined;
}

/**
 * The item schema of an array of objects, or `null` for any other array.
 *
 * Arrays of objects get a repeatable section with add/remove; everything else
 * is edited as a raw JSON list.
 */
export function arrayItemObject(
  node: JsonSchemaNode,
  defs: Record<string, JsonSchemaNode> | undefined,
): JsonSchemaNode | null {
  if (node.type !== "array" || !node.items) return null;
  const items = Array.isArray(node.items) ? node.items[0] : node.items;
  if (!items) return null;
  const resolved = resolveRef(items, defs);
  return isObjectNode(resolved) ? resolved : null;
}

/**
 * Coerce anything schema-shaped into a JSON Schema object node.
 *
 * Components onboarded before the typed schema stored a raw template of plain
 * values with a `"SECRET"` sentinel.  Converting on the fly lets one renderer
 * serve both.
 */
export function ensureJsonSchema(schema: unknown): ConfigSchema {
  if (schema && typeof schema === "object" && "properties" in schema) {
    return schema as ConfigSchema;
  }
  return legacyTemplateToSchema((schema || {}) as Record<string, unknown>);
}

function legacyTemplateToSchema(template: Record<string, unknown>): ConfigSchema {
  const properties: Record<string, JsonSchemaNode> = {};
  for (const [key, value] of Object.entries(template)) {
    properties[key] = legacyValueToProp(value);
  }
  return { type: "object", properties };
}

function legacyValueToProp(value: unknown): JsonSchemaNode {
  if (value === "SECRET") return { type: "string", format: "password", writeOnly: true };
  if (typeof value === "boolean") return { type: "boolean", default: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { type: "integer", default: value }
      : { type: "number", default: value };
  }
  if (Array.isArray(value)) return { type: "array", default: value };
  if (value !== null && typeof value === "object") {
    return legacyTemplateToSchema(value as Record<string, unknown>);
  }
  return { type: "string", default: value == null ? "" : value };
}

/**
 * Set a value at a dotted path (e.g. `accounts.0.auth.username`), creating
 * intermediate objects and arrays as needed.
 */
export function setNestedValue(target: Record<string, unknown>, dotPath: string, value: unknown) {
  const parts = dotPath.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    if (cursor[part] === undefined || cursor[part] === null) {
      cursor[part] = nextIsIndex ? [] : {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}
