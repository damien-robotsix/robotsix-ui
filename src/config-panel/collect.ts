/**
 * Read a rendered form back into a config document.
 *
 * The collector is the write half of the renderer's contract: it applies the
 * secret merge-on-write convention (a blank secret input is omitted, so the
 * stored value survives) and skips fields owned by the other plane.
 */

import {
  arrayItemObject,
  ensureJsonSchema,
  fieldPlane,
  isObjectNode,
  isPlainObject,
  isSecretField,
  mapValueSchema,
  resolveRef,
} from "./schema.js";
import { cssEscape } from "./html.js";
import type { ConfigFormOptions, ConfigValues, JsonSchemaNode } from "./types.js";

interface CollectContext {
  plane: string;
  defs: Record<string, JsonSchemaNode> | undefined;
  container: HTMLElement;
}

/**
 * Collect the values currently entered in *container*.
 *
 * Keys absent from the result mean "unchanged" to the standard
 * `PUT /config` surface, which merges partial updates.
 */
export function collectConfigValues(
  schema: unknown,
  container: HTMLElement,
  options: ConfigFormOptions = {},
): ConfigValues {
  const root = ensureJsonSchema(schema);
  const ctx: CollectContext = {
    plane: options.plane || "component",
    defs: root.$defs,
    container,
  };
  const result: ConfigValues = {};
  collectProperties(root, result, "", ctx);
  return result;
}

function collectProperties(
  schema: JsonSchemaNode,
  result: ConfigValues,
  prefix: string,
  ctx: CollectContext,
): void {
  const properties = schema.properties;
  if (!properties) return;

  for (const [key, propSchema] of Object.entries(properties)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const node = resolveRef(propSchema, ctx.defs);

    // Fields owned by the other plane are read-only here and must never be
    // written back — that is what keeps the two planes from drifting.
    if (fieldPlane(node) !== ctx.plane) continue;

    const itemSchema = arrayItemObject(node, ctx.defs);
    if (itemSchema) {
      const items = collectArrayItems(fullKey, itemSchema, ctx);
      if (items !== null) result[key] = items;
      continue;
    }

    const valueSchema = mapValueSchema(node, ctx.defs);
    if (valueSchema) {
      const entries = collectMapEntries(fullKey, valueSchema, ctx);
      if (entries !== null) result[key] = entries;
      continue;
    }

    if (isObjectNode(node)) {
      const nested: ConfigValues = {};
      collectProperties(node, nested, fullKey, ctx);
      if (Object.keys(nested).length > 0) result[key] = nested;
      continue;
    }

    const value = readField(fullKey, node, ctx);
    if (value !== OMIT) result[key] = value;
  }
}

function collectArrayItems(
  prefix: string,
  itemSchema: JsonSchemaNode,
  ctx: CollectContext,
): unknown[] | null {
  const section = ctx.container.querySelector(`[data-array-key="${cssEscape(prefix)}"]`);
  if (!section) return null;
  const items: unknown[] = [];
  // Direct children only — a nested array section owns its own items.  The
  // items live inside the collapsible section body, so go through it.
  section
    .querySelectorAll(
      ":scope > .rsu-config-section-body > .rsu-config-array-items > .rsu-config-array-item",
    )
    .forEach((el) => {
      const index = (el as HTMLElement).dataset.arrayIndex;
      if (index === undefined) return;
      const entry: ConfigValues = {};
      collectProperties(itemSchema, entry, `${prefix}.${index}`, ctx);
      items.push(entry);
    });
  return items;
}

/**
 * Read one map section back into a `{name: value}` object.
 *
 * The whole map is always returned, never a per-key subset: a map is stored
 * as one value, so an entry the operator removed has to be absent from what
 * is sent, and a partial map would silently resurrect it.  Entries with a
 * blank name are skipped — that is a half-added row, not a deletion.
 */
function collectMapEntries(
  prefix: string,
  valueSchema: JsonSchemaNode,
  ctx: CollectContext,
): ConfigValues | null {
  const section = ctx.container.querySelector(`[data-map-key="${cssEscape(prefix)}"]`);
  if (!section) return null;
  const entries: ConfigValues = {};
  section
    .querySelectorAll(
      ":scope > .rsu-config-section-body > .rsu-config-map-entries > .rsu-config-map-entry",
    )
    .forEach((el) => {
      const name = ((el as HTMLElement).dataset.mapName || "").trim();
      if (!name) return;
      const path = `${prefix}.${name}`;
      if (isObjectNode(valueSchema)) {
        const value: ConfigValues = {};
        collectProperties(valueSchema, value, path, ctx);
        entries[name] = value;
        return;
      }
      const value = readField(path, valueSchema, ctx);
      // A blank scalar entry keeps its name with an empty value rather than
      // vanishing: dropping it would read as "the operator removed this
      // alias", when all it means is "I did not retype this secret".
      entries[name] = value === OMIT ? "" : value;
    });
  return entries;
}

/** Sentinel meaning "this field contributes nothing to the update". */
const OMIT = Symbol("omit");

function readField(fullKey: string, node: JsonSchemaNode, ctx: CollectContext): unknown {
  const el = ctx.container.querySelector(`[data-key="${cssEscape(fullKey)}"]`);
  if (!el) return OMIT;

  if (el instanceof HTMLInputElement && el.dataset.json === "1") {
    try {
      return JSON.parse(el.value);
    } catch {
      // Unparseable JSON → omit, so the stored list is kept rather than
      // overwritten with garbage.
      return OMIT;
    }
  }

  if (el instanceof HTMLInputElement && el.type === "checkbox") {
    return el.checked;
  }

  if (el instanceof HTMLInputElement && el.type === "number") {
    if (el.value === "") return OMIT;
    return node.type === "integer" ? parseInt(el.value, 10) : parseFloat(el.value);
  }

  const value = (el as HTMLInputElement | HTMLSelectElement).value;

  if (isSecretField(node)) {
    // Merge-on-write: only an explicitly typed, non-blank secret overwrites
    // the stored one (config-standard.md § 3).
    return value === "" ? OMIT : value;
  }

  // An empty optional text leaf is omitted rather than stored as "", so a
  // nullable object whose fields are all blank collapses away and validates.
  return value === "" ? OMIT : value;
}

/**
 * Reduce *next* to only the keys whose value differs from *current*.
 *
 * The Settings panel sends only changed keys, per config-ownership.md.  Keys
 * absent from *next* (an unchanged secret, an omitted blank) are never
 * resurrected, and a nested object that ends up empty is dropped.
 *
 * Pass *schema* whenever the config has maps (`dict[str, …]`): a map is one
 * value, so it is diffed whole.  Without the schema a map is indistinguishable
 * from a nested object and a *removed* entry would diff away to nothing —
 * the deletion would never reach the surface.
 */
export function diffConfigValues(
  current: ConfigValues,
  next: ConfigValues,
  schema?: unknown,
): ConfigValues {
  const root = schema === undefined ? undefined : ensureJsonSchema(schema);
  return diffValues(current, next, root, root?.$defs);
}

function diffValues(
  current: ConfigValues,
  next: ConfigValues,
  schema: JsonSchemaNode | undefined,
  defs: Record<string, JsonSchemaNode> | undefined,
): ConfigValues {
  const changed: ConfigValues = {};
  for (const [key, value] of Object.entries(next)) {
    const before = current[key];
    const node = schema?.properties ? resolveRef(schema.properties[key], defs) : undefined;
    const isMap = node ? mapValueSchema(node, defs) !== null : false;
    if (!isMap && isPlainObject(value) && isPlainObject(before)) {
      const nested = diffValues(before, value, node, defs);
      if (Object.keys(nested).length > 0) changed[key] = nested;
      continue;
    }
    if (!deepEqual(before, value)) changed[key] = value;
  }
  return changed;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
