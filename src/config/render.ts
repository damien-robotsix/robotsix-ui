/**
 * Schema-driven form renderer.
 *
 * Renders a component's committed `config/config.schema.json` into typed
 * inputs — a number field for an `int`, a checkbox for a `bool`, a dropdown
 * for an enum, a masked input with a set/unset badge for a secret.  This is
 * the single renderer every RobotSix UI mounts, so that the deploy UI and a
 * component's own Settings panel present identical fields with identical
 * semantics (config-ownership.md, "cross-UI uniformity").
 *
 * `render.ts` is the orchestrator: it walks the schema tree and delegates the
 * cohesive pieces to submodules — `section-state.ts` (collapsible-section
 * shell and per-session collapse persistence), `render-rows.ts` (scalar field
 * rows), `render-array.ts` (repeatable list-of-object sections) and
 * `render-map.ts` (open-ended map sections).
 */

import { cssEscape } from "./html.js";
import {
  arrayItemObject,
  ensureJsonSchema,
  isObjectNode,
  isPlainObject,
  mapValueSchema,
  resolveRef,
} from "./schema.js";
import type { ConfigValues, JsonSchemaNode, RenderConfigFormOptions } from "./types.js";
import {
  applyFlags,
  applySectionState,
  makeSection,
  saveSectionCollapsed,
  sectionBody,
  sectionTitle,
  SECTION_COLLAPSED_CLASS,
  type RenderContext,
} from "./section-state.js";
import { buildRow } from "./render-rows.js";
import { buildArraySection } from "./render-array.js";
import { buildMapSection } from "./render-map.js";

// Re-export the public CSS-class constants so existing importers of
// `./render.js` keep working after the split.
export { COLLAPSIBLE_SECTION_CLASS, FOREIGN_CLASS, SECTION_COLLAPSED_CLASS } from "./section-state.js";

/**
 * Render *schema* into *container*, pre-filled from *current*.
 *
 * Replaces any previous content.  Every settings group renders under a
 * collapsible section header; open/closed state persists for the session.
 */
export function renderConfigForm(
  container: HTMLElement,
  schema: unknown,
  current: ConfigValues | null | undefined,
  options: RenderConfigFormOptions = {},
): void {
  const root = ensureJsonSchema(schema);
  container.innerHTML = "";
  const ctx: RenderContext = {
    plane: options.plane || "component",
    defs: root.$defs,
    onChange: options.onChange,
    componentId: options.componentId,
  };
  renderNode(root, current ?? {}, "", container, ctx);

  // Wire the collapsible-description toggle via event delegation so it
  // covers rows and sections uniformly — even those rendered later by
  // array/map add buttons.
  container.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest(".rsu-config-desc-toggle");
    if (!button) return;
    const block = button.parentElement;
    if (!block) return;
    const collapsed = block.classList.toggle("rsu-config-desc--collapsed");
    (button as HTMLElement).textContent = collapsed ? "more…" : "less";
  });

  // Wire the section-collapse toggle the same way: clicking any group header
  // reveals (or re-hides) its body, and the choice sticks for the session.
  container.addEventListener("click", (event) => {
    const toggle = (event.target as HTMLElement).closest(".rsu-config-section-toggle");
    if (!toggle) return;
    const section = toggle.closest(".rsu-config-section");
    if (!section) return;
    const collapsed = section.classList.toggle(SECTION_COLLAPSED_CLASS);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    saveSectionCollapsed(sectionTitle(section as HTMLElement), collapsed);
  });
}

/** Clear any inline validation error previously placed on a field. */
export function clearFieldErrors(container: HTMLElement): void {
  container.querySelectorAll(".rsu-config-error").forEach((el) => el.remove());
  container
    .querySelectorAll(".rsu-config-row--invalid")
    .forEach((el) => el.classList.remove("rsu-config-row--invalid"));
}

/**
 * Attach a validation message to the row owning *key*.
 *
 * Returns `false` when no such row exists, so the caller can fall back to a
 * panel-level banner.
 */
export function showFieldError(container: HTMLElement, key: string, message: string): boolean {
  const input = container.querySelector(`[data-key="${cssEscape(key)}"]`);
  const row = input?.closest(".rsu-config-row");
  if (!row) return false;
  row.classList.add("rsu-config-row--invalid");
  const span = document.createElement("span");
  span.className = "rsu-config-error";
  span.textContent = message;
  row.appendChild(span);
  return true;
}

/**
 * Walk *schema*'s properties into *container*, bucketing keys by their
 * optional `group` label and delegating each property to {@link renderProperty}
 * (or {@link buildRow} for top-level scalars under "General").
 *
 * Exported for the array/map submodules, which recurse back into it to render
 * nested object schemas.
 */
export function renderNode(
  schema: JsonSchemaNode,
  current: unknown,
  prefix: string,
  container: HTMLElement,
  ctx: RenderContext,
): void {
  const properties = schema.properties;
  if (!properties) return;

  const required = schema.required || [];
  const values = isPlainObject(current) ? current : {};
  const entries = Object.entries(properties);

  // Bucket entries by their optional `group` label so related keys render
  // under one collapsible header instead of a flat list of sections.
  const groups = new Map<string, [string, JsonSchemaNode][]>();
  const ungrouped: [string, JsonSchemaNode][] = [];
  for (const entry of entries) {
    const resolved = resolveRef(entry[1], ctx.defs);
    const label = typeof resolved.group === "string" ? resolved.group.trim() : "";
    if (label) {
      const bucket = groups.get(label);
      if (bucket) bucket.push(entry);
      else groups.set(label, [entry]);
    } else {
      ungrouped.push(entry);
    }
  }

  // Render each group under its own collapsible header.
  for (const [label, members] of groups) {
    const section = makeSection(label);
    applySectionState(section, false);
    const body = sectionBody(section);
    for (const [key, propSchema] of members) {
      renderProperty(
        body,
        key,
        prefix ? `${prefix}.${key}` : key,
        propSchema,
        values[key],
        required,
        ctx,
      );
    }
    container.appendChild(section);
  }

  // Then the ungrouped entries.  At the top level scalars go under "General"
  // so they cannot float between named object sections; objects keep their own
  // sections.  Nested levels render scalars inline.
  if (prefix === "") {
    const scalars: [string, JsonSchemaNode][] = [];
    const objects: [string, JsonSchemaNode][] = [];
    for (const entry of ungrouped) {
      const resolved = resolveRef(entry[1], ctx.defs);
      // A list of objects and an open-ended map each render as their own
      // repeatable section, so they belong with the sections rather than as
      // scalar rows under "General".
      const isSection =
        isObjectNode(resolved) ||
        arrayItemObject(resolved, ctx.defs) ||
        mapValueSchema(resolved, ctx.defs);
      (isSection ? objects : scalars).push(entry);
    }
    if (scalars.length > 0) {
      const section = makeSection("General");
      applySectionState(section, false);
      const body = sectionBody(section);
      for (const [key, propSchema] of scalars) {
        body.appendChild(buildRow(key, key, propSchema, values[key], required, ctx));
      }
      container.appendChild(section);
    }
    for (const [key, propSchema] of objects) {
      renderProperty(container, key, key, propSchema, values[key], required, ctx);
    }
    return;
  }

  for (const [key, propSchema] of ungrouped) {
    renderProperty(container, key, `${prefix}.${key}`, propSchema, values[key], required, ctx);
  }
}

/** Render one property into *container* — a row, object section, or repeatable section. */
function renderProperty(
  container: HTMLElement,
  key: string,
  fullKey: string,
  propSchema: JsonSchemaNode,
  currentVal: unknown,
  requiredKeys: string[],
  ctx: RenderContext,
): void {
  const resolved = resolveRef(propSchema, ctx.defs);

  const itemObject = arrayItemObject(resolved, ctx.defs);
  if (itemObject) {
    container.appendChild(buildArraySection(key, fullKey, resolved, itemObject, currentVal, ctx));
    return;
  }

  const mapValues = mapValueSchema(resolved, ctx.defs);
  if (mapValues) {
    container.appendChild(buildMapSection(key, fullKey, resolved, mapValues, currentVal, ctx));
    return;
  }

  if (isObjectNode(resolved)) {
    // The field's own key names the section — a `$ref`'s title is the
    // pydantic class name ("ImapConfig"), which reads worse than "imap".
    const section = makeSection(key, resolved.description);
    applyFlags(section, resolved, ctx);
    const body = makeFeatureBlockBody(section, resolved, currentVal);
    renderNode(resolved, currentVal, fullKey, body, ctx);
    container.appendChild(section);
    return;
  }

  container.appendChild(buildRow(fullKey, key, propSchema, currentVal, requiredKeys, ctx));
}

/**
 * Make an object section that carries its own boolean `enabled` switch — a
 * "feature block" like `sftp`, `public_fetch` or `gateway_route` — collapse
 * to just its title when the switch is off, so a disabled feature's knobs stay
 * out of the operator's way until they expand it.
 *
 * Every section is collapsible; this only sets the *default* open/closed state
 * (collapsed for a disabled feature block, otherwise open) and returns the
 * body the section's children should render into.
 */
function makeFeatureBlockBody(
  section: HTMLElement,
  node: JsonSchemaNode,
  current: unknown,
): HTMLElement {
  const enabledProp = node.properties?.enabled;
  const isFeatureBlock = enabledProp !== undefined && enabledProp.type === "boolean";
  const values = isPlainObject(current) ? current : {};
  const enabled = isFeatureBlock
    ? values.enabled !== undefined
      ? values.enabled === true
      : enabledProp.default === true
    : true;

  applySectionState(section, isFeatureBlock && !enabled);
  return sectionBody(section);
}
