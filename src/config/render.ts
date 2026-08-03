/**
 * Schema-driven form renderer.
 *
 * Renders a component's committed `config/config.schema.json` into typed
 * inputs — a number field for an `int`, a checkbox for a `bool`, a dropdown
 * for an enum, a masked input with a set/unset badge for a secret.  This is
 * the single renderer every RobotSix UI mounts, so that the deploy UI and a
 * component's own Settings panel present identical fields with identical
 * semantics (config-ownership.md, "cross-UI uniformity").
 */

import { escAttr, escHtml, renderInlineMarkdown } from "./html.js";
import {
  arrayItemObject,
  ensureJsonSchema,
  fieldPlane,
  isObjectNode,
  isSecretField,
  mapValueSchema,
  resolveRef,
} from "./schema.js";
import type {
  ConfigValues,
  DeployPlane,
  JsonSchemaNode,
  RenderConfigFormOptions,
} from "./types.js";

/** Marks a row/section that the "Show advanced settings" toggle controls. */
export const ADVANCED_CLASS = "rsu-advanced";
/** Marks a row/section owned by the other plane — rendered read-only. */
export const FOREIGN_CLASS = "rsu-config-foreign";

interface RenderContext {
  plane: DeployPlane;
  defs: Record<string, JsonSchemaNode> | undefined;
  onChange?: () => void;
}

/**
 * Render *schema* into *container*, pre-filled from *current*.
 *
 * Replaces any previous content.  Advanced fields start hidden; call
 * {@link setAdvancedVisible} to reveal them.
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
  };
  renderNode(root, current ?? {}, "", container, ctx);
  setAdvancedVisible(container, false);

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
}

/** True when the rendered form contains at least one advanced field. */
export function hasAdvancedFields(container: HTMLElement): boolean {
  return container.querySelector(`.${ADVANCED_CLASS}`) !== null;
}

/** Show or hide every advanced field in a rendered form. */
export function setAdvancedVisible(container: HTMLElement, visible: boolean): void {
  container.querySelectorAll(`.${ADVANCED_CLASS}`).forEach((el) => {
    (el as HTMLElement).hidden = !visible;
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

function cssEscape(value: string): string {
  const api = globalThis.CSS;
  return api && typeof api.escape === "function" ? api.escape(value) : value;
}

function renderNode(
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
  let entries = Object.entries(properties);

  // At the top level, scalars are grouped under "General" so they cannot float
  // between named object sections.
  if (prefix === "") {
    const scalars: [string, JsonSchemaNode][] = [];
    const objects: [string, JsonSchemaNode][] = [];
    for (const entry of entries) {
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
      for (const [key, propSchema] of scalars) {
        section.appendChild(buildRow(key, key, propSchema, values[key], required, ctx));
      }
      container.appendChild(section);
    }
    entries = objects;
  }

  for (const [key, propSchema] of entries) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const resolved = resolveRef(propSchema, ctx.defs);
    const currentVal = values[key];

    const itemObject = arrayItemObject(resolved, ctx.defs);
    if (itemObject) {
      container.appendChild(buildArraySection(key, fullKey, resolved, itemObject, currentVal, ctx));
      continue;
    }

    const mapValues = mapValueSchema(resolved, ctx.defs);
    if (mapValues) {
      container.appendChild(buildMapSection(key, fullKey, resolved, mapValues, currentVal, ctx));
      continue;
    }

    if (isObjectNode(resolved)) {
      // The field's own key names the section — a `$ref`'s title is the
      // pydantic class name ("ImapConfig"), which reads worse than "imap".
      const section = makeSection(key, resolved.description);
      applyFlags(section, resolved, ctx);
      renderNode(resolved, currentVal, fullKey, section, ctx);
      container.appendChild(section);
      continue;
    }

    container.appendChild(buildRow(fullKey, key, propSchema, currentVal, required, ctx));
  }
}

function makeSection(title: string, description?: string): HTMLElement {
  const section = document.createElement("div");
  section.className = "rsu-config-section";
  section.innerHTML =
    `<h3 class="rsu-config-section-title">${escHtml(title)}</h3>` +
    (description ? renderDescription(description) : "");
  return section;
}

function renderDescription(description: string): string {
  const rendered = renderInlineMarkdown(description);
  const isLong = description.length > 140 || description.includes("\n");
  if (!isLong) return `<p class="rsu-config-desc">${rendered}</p>`;

  let firstLine = description.split("\n")[0];
  if (firstLine.length > 120) firstLine = `${firstLine.slice(0, 120)}…`;
  return (
    '<div class="rsu-config-desc rsu-config-desc--collapsed">' +
    `<span class="rsu-config-desc-short">${renderInlineMarkdown(firstLine)}</span>` +
    `<span class="rsu-config-desc-full">${rendered}</span>` +
    '<button type="button" class="rsu-config-desc-toggle">more…</button>' +
    "</div>"
  );
}

function applyFlags(el: HTMLElement, node: JsonSchemaNode, ctx: RenderContext): boolean {
  if (node.advanced) el.classList.add(ADVANCED_CLASS);
  const foreign = fieldPlane(node) !== ctx.plane;
  if (foreign) el.classList.add(FOREIGN_CLASS);
  return foreign;
}

/** Wire the change callback on every input in the row. */
function wireRow(row: HTMLElement, ctx: RenderContext): HTMLElement {
  if (ctx.onChange) {
    row.querySelectorAll("[data-key]").forEach((input) => {
      input.addEventListener("change", () => ctx.onChange?.());
      input.addEventListener("input", () => ctx.onChange?.());
    });
  }
  return row;
}

function buildRow(
  fullKey: string,
  labelKey: string,
  propSchema: JsonSchemaNode,
  currentVal: unknown,
  requiredKeys: string[],
  ctx: RenderContext,
): HTMLElement {
  const node = resolveRef(propSchema, ctx.defs);
  const row = document.createElement("div");
  row.className = "rsu-config-row";
  const foreign = applyFlags(row, node, ctx);
  const disabled = foreign ? " disabled" : "";

  const isRequired = requiredKeys.includes(labelKey);
  const secret = isSecretField(node);
  const defaultVal = node.default ?? "";
  const displayVal = currentVal !== undefined && currentVal !== null ? currentVal : defaultVal;

  const helpTitle = node.description ? `${node.description}\n(${fullKey})` : fullKey;
  const label =
    `<span class="rsu-config-key" title="${escAttr(helpTitle)}">` +
    `${escHtml(labelKey)}${isRequired ? " *" : ""}</span>`;
  const help = node.description
    ? `<span class="rsu-config-help">${renderInlineMarkdown(node.description)}</span>`
    : "";

  if (secret) {
    // The value is never echoed, so "already set" is inferred from whatever
    // non-empty mask the surface returned.  Blank input means "keep stored
    // value" — the merge-on-write convention of config-standard.md § 3.
    const alreadySet = currentVal !== undefined && currentVal !== null && currentVal !== "";
    const placeholder = alreadySet
      ? "(already set — enter a new value to change)"
      : "(not set — can be saved later)";
    row.innerHTML =
      label +
      `<input type="password" class="rsu-config-value" data-key="${escAttr(fullKey)}"` +
      ` data-secret="1" value="" placeholder="${escAttr(placeholder)}"` +
      ` autocomplete="off"${disabled}>` +
      `<span class="rsu-badge ${alreadySet ? "rsu-badge--success" : "rsu-badge--warning"}">` +
      `${alreadySet ? "set" : "not set"}</span>` +
      help;
    return wireRow(row, ctx);
  }

  if (node.type === "array" || Array.isArray(displayVal)) {
    // A plain (non-object) list is edited as raw JSON.  An unparseable value is
    // skipped on collect so the stored value survives.
    const jsonVal = JSON.stringify(displayVal === "" ? [] : displayVal);
    row.innerHTML =
      label +
      `<input type="text" class="rsu-config-value" data-key="${escAttr(fullKey)}"` +
      ` data-json="1" value="${escAttr(jsonVal)}" spellcheck="false"${disabled}>` +
      '<span class="rsu-config-hint">JSON list</span>' +
      help;
    return wireRow(row, ctx);
  }

  if (Array.isArray(node.enum)) {
    const selected = String(currentVal ?? defaultVal ?? "");
    const options = node.enum
      .map((value) => {
        const str = String(value);
        return `<option value="${escAttr(str)}"${str === selected ? " selected" : ""}>${escHtml(
          str,
        )}</option>`;
      })
      .join("");
    row.innerHTML =
      label +
      `<select class="rsu-config-value" data-key="${escAttr(fullKey)}"${disabled}>${options}</select>` +
      help;
    return wireRow(row, ctx);
  }

  if (node.type === "integer" || node.type === "number") {
    const step = node.type === "integer" ? ' step="1"' : "";
    row.innerHTML =
      label +
      `<input type="number" class="rsu-config-value" data-key="${escAttr(fullKey)}"` +
      ` value="${escAttr(String(displayVal))}"${step}${disabled}>` +
      help;
    return wireRow(row, ctx);
  }

  if (node.type === "boolean") {
    const checked = displayVal === true || displayVal === "true" || displayVal === 1;
    row.innerHTML =
      label +
      `<input type="checkbox" class="rsu-config-value" data-key="${escAttr(fullKey)}"` +
      `${checked ? " checked" : ""}${disabled}>` +
      help;
    return wireRow(row, ctx);
  }

  row.innerHTML =
    label +
    `<input type="text" class="rsu-config-value" data-key="${escAttr(fullKey)}"` +
    ` value="${escAttr(String(displayVal))}"${disabled}>` +
    help;
  return wireRow(row, ctx);
}

function buildArraySection(
  labelKey: string,
  prefix: string,
  node: JsonSchemaNode,
  itemSchema: JsonSchemaNode,
  currentVal: unknown,
  ctx: RenderContext,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "rsu-config-section rsu-config-array";
  section.dataset.arrayKey = prefix;
  applyFlags(section, node, ctx);
  section.innerHTML =
    `<h3 class="rsu-config-section-title">${escHtml(labelKey)}</h3>` +
    (node.description ? renderDescription(node.description) : "");

  const items = document.createElement("div");
  items.className = "rsu-config-array-items";
  section.appendChild(items);

  const values = Array.isArray(currentVal) ? currentVal : [];
  values.forEach((item, index) => appendArrayItem(items, prefix, index, itemSchema, item, ctx));

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "rsu-btn rsu-config-array-add";
  addBtn.textContent = `+ Add ${labelKey} item`;
  addBtn.addEventListener("click", () => {
    const index = items.querySelectorAll(":scope > .rsu-config-array-item").length;
    appendArrayItem(items, prefix, index, itemSchema, {}, ctx);
    setAdvancedVisible(items, false);
    ctx.onChange?.();
  });
  section.appendChild(addBtn);
  return section;
}

function appendArrayItem(
  container: HTMLElement,
  prefix: string,
  index: number,
  itemSchema: JsonSchemaNode,
  itemValue: unknown,
  ctx: RenderContext,
): void {
  const item = document.createElement("div");
  item.className = "rsu-config-array-item";
  item.dataset.arrayIndex = String(index);
  item.dataset.arrayPrefix = prefix;

  const values = isPlainObject(itemValue) ? itemValue : {};
  const heading = values.id ?? values.name ?? values.email ?? values.account_id ?? `[${index}]`;

  const header = document.createElement("div");
  header.className = "rsu-config-array-item-header";
  header.innerHTML = `<span>${escHtml(String(heading))}</span>`;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "rsu-config-array-remove";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    item.remove();
    reindexArrayItems(container);
    ctx.onChange?.();
  });
  header.appendChild(removeBtn);
  item.appendChild(header);

  const body = document.createElement("div");
  body.className = "rsu-config-array-item-body";
  renderNode(itemSchema, values, `${prefix}.${index}`, body, ctx);
  item.appendChild(body);

  container.appendChild(item);
}

function buildMapSection(
  labelKey: string,
  prefix: string,
  node: JsonSchemaNode,
  valueSchema: JsonSchemaNode,
  currentVal: unknown,
  ctx: RenderContext,
): HTMLElement {
  const section = document.createElement("div");
  section.className = "rsu-config-section rsu-config-map";
  section.dataset.mapKey = prefix;
  applyFlags(section, node, ctx);
  section.innerHTML =
    `<h3 class="rsu-config-section-title">${escHtml(labelKey)}</h3>` +
    (node.description ? renderDescription(node.description) : "");

  const entries = document.createElement("div");
  entries.className = "rsu-config-map-entries";
  section.appendChild(entries);

  const values = isPlainObject(currentVal) ? currentVal : {};
  for (const [name, value] of Object.entries(values)) {
    appendMapEntry(entries, prefix, name, valueSchema, value, ctx);
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "rsu-btn rsu-config-map-add";
  addBtn.textContent = `+ Add ${labelKey} entry`;
  addBtn.addEventListener("click", () => {
    appendMapEntry(entries, prefix, "", valueSchema, undefined, ctx);
    setAdvancedVisible(entries, false);
    ctx.onChange?.();
  });
  section.appendChild(addBtn);
  return section;
}

/**
 * Render one `name → value` entry of a map.
 *
 * The entry's key is an editable input, because the key *is* configuration —
 * a Langfuse project name, an OpenRouter key alias.  Renaming it re-stamps
 * the `data-key` path of every field below it, which is what keeps the
 * collector and the surface's `422` field paths pointing at the same row.
 */
function appendMapEntry(
  container: HTMLElement,
  prefix: string,
  name: string,
  valueSchema: JsonSchemaNode,
  value: unknown,
  ctx: RenderContext,
): void {
  const entry = document.createElement("div");
  entry.className = "rsu-config-array-item rsu-config-map-entry";
  entry.dataset.mapPrefix = prefix;
  entry.dataset.mapName = name;

  const header = document.createElement("div");
  header.className = "rsu-config-array-item-header rsu-config-map-entry-header";
  header.innerHTML =
    `<input type="text" class="rsu-config-map-name" value="${escAttr(name)}"` +
    ' spellcheck="false" placeholder="name">';
  entry.appendChild(header);

  const body = document.createElement("div");
  body.className = "rsu-config-array-item-body";
  entry.appendChild(body);

  const renderBody = (entryName: string) => {
    body.innerHTML = "";
    const path = `${prefix}.${entryName}`;
    if (isObjectNode(valueSchema)) {
      renderNode(valueSchema, value, path, body, ctx);
    } else {
      body.appendChild(buildRow(path, "value", valueSchema, value, [], ctx));
    }
  };
  renderBody(name);

  const nameInput = header.querySelector(".rsu-config-map-name") as HTMLInputElement;
  nameInput.addEventListener("input", () => {
    const next = nameInput.value.trim();
    if (next === entry.dataset.mapName) return;
    entry.dataset.mapName = next;
    // Re-stamping beats re-rendering: it keeps whatever the operator has
    // already typed into the entry's fields.
    restampMapEntry(body, prefix, next);
    ctx.onChange?.();
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "rsu-config-array-remove";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    entry.remove();
    ctx.onChange?.();
  });
  header.appendChild(removeBtn);

  container.appendChild(entry);
}

/** Point every `data-key` under a renamed map entry at the new key. */
function restampMapEntry(body: HTMLElement, prefix: string, name: string): void {
  body.querySelectorAll("[data-key]").forEach((node) => {
    const input = node as HTMLElement;
    const key = input.dataset.key;
    if (!key || !key.startsWith(`${prefix}.`)) return;
    const tail = key.slice(prefix.length + 1);
    // The old entry name is the first path segment after the prefix.
    const rest = tail.includes(".") ? tail.slice(tail.indexOf(".")) : "";
    input.dataset.key = `${prefix}.${name}${rest}`;
  });
}

/** Renumber `data-key` paths after a removal so indices stay contiguous. */
function reindexArrayItems(container: HTMLElement): void {
  container.querySelectorAll(":scope > .rsu-config-array-item").forEach((el, newIndex) => {
    const item = el as HTMLElement;
    const oldIndex = Number(item.dataset.arrayIndex);
    const prefix = item.dataset.arrayPrefix;
    if (prefix !== undefined && oldIndex !== newIndex) {
      const oldSeg = `${prefix}.${oldIndex}.`;
      const newSeg = `${prefix}.${newIndex}.`;
      item.querySelectorAll("[data-key]").forEach((node) => {
        const input = node as HTMLElement;
        const key = input.dataset.key;
        if (key && key.startsWith(oldSeg)) {
          input.dataset.key = newSeg + key.slice(oldSeg.length);
        }
      });
    }
    item.dataset.arrayIndex = String(newIndex);
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
