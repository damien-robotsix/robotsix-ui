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

import { cssEscape, escAttr, escHtml, renderInlineMarkdown } from "./html.js";
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
import type {
  ConfigValues,
  DeployPlane,
  JsonSchemaNode,
  RenderConfigFormOptions,
} from "./types.js";

/** Marks a row/section owned by the other plane — rendered read-only. */
export const FOREIGN_CLASS = "rsu-config-foreign";
/** Marks a section whose header toggles its body open and shut. */
export const COLLAPSIBLE_SECTION_CLASS = "rsu-config-section--collapsible";
/** Marks a collapsible section that is currently collapsed. */
export const SECTION_COLLAPSED_CLASS = "rsu-config-section--collapsed";

interface RenderContext {
  plane: DeployPlane;
  defs: Record<string, JsonSchemaNode> | undefined;
  onChange?: () => void;
  componentId?: string;
}

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

/** The section's header label, used as its stable per-session key. */
function sectionTitle(section: HTMLElement): string {
  const toggle = section.querySelector(".rsu-config-section-toggle");
  return (toggle as HTMLElement | null)?.textContent?.trim() ?? "";
}

const SECTION_STATE_PREFIX = "rsu-config:section:";

/**
 * The session-persisted collapsed flag for *title*, or `null` when the
 * operator has not touched that section this session.
 */
function loadSectionCollapsed(title: string): boolean | null {
  try {
    const raw = sessionStorage.getItem(SECTION_STATE_PREFIX + title);
    return raw === null ? null : raw === "1";
  } catch {
    // Storage unavailable (private mode, SSR): collapse state just won't persist.
    return null;
  }
}

/** Persist a group header's open/closed choice for the rest of the session. */
function saveSectionCollapsed(title: string, collapsed: boolean): void {
  try {
    if (collapsed) sessionStorage.setItem(SECTION_STATE_PREFIX + title, "1");
    else sessionStorage.removeItem(SECTION_STATE_PREFIX + title);
  } catch {
    // Non-fatal: same as loadSectionCollapsed.
  }
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

/** Build a collapsible section with a toggle-button header and a body element. */
function makeSection(title: string, description?: string): HTMLElement {
  const section = document.createElement("div");
  section.className = `rsu-config-section ${COLLAPSIBLE_SECTION_CLASS}`;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "rsu-config-section-title rsu-config-section-toggle";
  toggle.setAttribute("aria-expanded", "true");
  toggle.textContent = title;
  section.appendChild(toggle);
  if (description) {
    const desc = document.createElement("div");
    desc.innerHTML = renderDescription(description);
    section.appendChild(desc);
  }
  const body = document.createElement("div");
  body.className = "rsu-config-section-body";
  section.appendChild(body);
  return section;
}

/** The body element of a collapsible section. */
function sectionBody(section: HTMLElement): HTMLElement {
  return section.querySelector(".rsu-config-section-body") as HTMLElement;
}

/**
 * Set a section's collapsed state, applying the per-session preference when
 * present, else *defaultCollapsed*.
 */
function applySectionState(section: HTMLElement, defaultCollapsed: boolean): void {
  const stored = loadSectionCollapsed(sectionTitle(section));
  const collapsed = stored !== null ? stored : defaultCollapsed;
  setSectionCollapsed(section, collapsed);
}

/** Toggle *section*'s collapsed class and the toggle button's `aria-expanded`. */
function setSectionCollapsed(section: HTMLElement, collapsed: boolean): void {
  section.classList.toggle(SECTION_COLLAPSED_CLASS, collapsed);
  const toggle = section.querySelector(".rsu-config-section-toggle");
  if (toggle) toggle.setAttribute("aria-expanded", String(!collapsed));
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
  const foreign = fieldPlane(node) !== ctx.plane;
  if (foreign) el.classList.add(FOREIGN_CLASS);
  return foreign;
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

interface RowBuilderParams {
  row: HTMLElement;
  fullKey: string;
  label: string;
  help: string;
  disabled: string;
  displayVal: unknown;
  node: JsonSchemaNode;
  currentVal: unknown;
  defaultVal: unknown;
  ctx: RenderContext;
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
  const defaultVal = node.default ?? "";
  const displayVal = currentVal !== undefined && currentVal !== null ? currentVal : defaultVal;

  const helpTitle = node.description
    ? `${node.description}\n(${fullKey})`
    : fullKey !== labelKey
      ? fullKey
      : "";
  const titleAttr = helpTitle ? ` title="${escAttr(helpTitle)}"` : "";
  const label =
    `<span class="rsu-config-key"${titleAttr}>` +
    `${escHtml(labelKey)}${isRequired ? " *" : ""}</span>`;
  const help = node.description
    ? `<span class="rsu-config-help">${renderInlineMarkdown(node.description)}</span>`
    : "";

  const params: RowBuilderParams = {
    row,
    fullKey,
    label,
    help,
    disabled,
    displayVal,
    node,
    currentVal,
    defaultVal,
    ctx,
  };

  if (isSecretField(node)) return buildSecretRow(params);
  if (node.type === "array" || Array.isArray(displayVal)) return buildJsonListRow(params);
  if (Array.isArray(node.enum)) return buildSelectRow(params);
  if (node.type === "integer" || node.type === "number") return buildNumberRow(params);
  if (node.type === "boolean") return buildBooleanRow(params);
  return buildTextRow(params);
}

function buildSecretRow(p: RowBuilderParams): HTMLElement {
  // The value is never echoed, so "already set" is inferred from whatever
  // non-empty mask the surface returned.  Blank input means "keep stored
  // value" — the merge-on-write convention of config-standard.md § 3.
  const alreadySet = p.currentVal !== undefined && p.currentVal !== null && p.currentVal !== "";
  const placeholder = alreadySet
    ? "(already set — enter a new value to change)"
    : "(not set — can be saved later)";
  p.row.innerHTML =
    p.label +
    `<input type="password" class="rsu-config-value" data-key="${escAttr(p.fullKey)}"` +
    ` data-secret="1" value="" placeholder="${escAttr(placeholder)}"` +
    ` autocomplete="off"${p.disabled}>` +
    `<span class="rsu-badge ${alreadySet ? "rsu-badge--success" : "rsu-badge--warning"}">` +
    `${alreadySet ? "set" : "not set"}</span>` +
    p.help;
  return wireRow(p.row, p.ctx);
}

function buildJsonListRow(p: RowBuilderParams): HTMLElement {
  // A plain (non-object) list is edited as raw JSON.  An unparseable value is
  // skipped on collect so the stored value survives.
  const jsonVal = JSON.stringify(p.displayVal === "" ? [] : p.displayVal);
  p.row.innerHTML =
    p.label +
    `<input type="text" class="rsu-config-value" data-key="${escAttr(p.fullKey)}"` +
    ` data-json="1" value="${escAttr(jsonVal)}" spellcheck="false"${p.disabled}>` +
    '<span class="rsu-config-hint">JSON list</span>' +
    p.help;
  return wireRow(p.row, p.ctx);
}

function buildSelectRow(p: RowBuilderParams): HTMLElement {
  const selected = String(p.currentVal ?? p.defaultVal ?? "");
  const options = p.node
    .enum!.map((value) => {
      const str = String(value);
      return `<option value="${escAttr(str)}"${str === selected ? " selected" : ""}>${escHtml(
        str,
      )}</option>`;
    })
    .join("");
  p.row.innerHTML =
    p.label +
    `<select class="rsu-config-value" data-key="${escAttr(p.fullKey)}"${p.disabled}>${options}</select>` +
    p.help;
  return wireRow(p.row, p.ctx);
}

function buildNumberRow(p: RowBuilderParams): HTMLElement {
  const step = p.node.type === "integer" ? ' step="1"' : "";
  p.row.innerHTML =
    p.label +
    `<input type="number" class="rsu-config-value" data-key="${escAttr(p.fullKey)}"` +
    ` value="${escAttr(String(p.displayVal))}"${step}${p.disabled}>` +
    p.help;
  return wireRow(p.row, p.ctx);
}

function buildBooleanRow(p: RowBuilderParams): HTMLElement {
  const checked = p.displayVal === true || p.displayVal === "true" || p.displayVal === 1;
  p.row.innerHTML =
    p.label +
    `<input type="checkbox" class="rsu-config-value" data-key="${escAttr(p.fullKey)}"` +
    `${checked ? " checked" : ""}${p.disabled}>` +
    p.help;
  return wireRow(p.row, p.ctx);
}

function buildTextRow(p: RowBuilderParams): HTMLElement {
  p.row.innerHTML =
    p.label +
    `<input type="text" class="rsu-config-value" data-key="${escAttr(p.fullKey)}"` +
    ` value="${escAttr(String(p.displayVal))}"${p.disabled}>` +
    p.help;
  return wireRow(p.row, p.ctx);
}

function buildArraySection(
  labelKey: string,
  prefix: string,
  node: JsonSchemaNode,
  itemSchema: JsonSchemaNode,
  currentVal: unknown,
  ctx: RenderContext,
): HTMLElement {
  const section = makeSection(labelKey, node.description);
  section.classList.add("rsu-config-array");
  section.dataset.arrayKey = prefix;
  applyFlags(section, node, ctx);
  applySectionState(section, false);
  const body = sectionBody(section);

  const items = document.createElement("div");
  items.className = "rsu-config-array-items";
  body.appendChild(items);

  const values = Array.isArray(currentVal) ? currentVal : [];
  values.forEach((item, index) => appendArrayItem(items, prefix, index, itemSchema, item, ctx));

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "rsu-btn rsu-config-array-add";
  addBtn.textContent = `+ Add ${labelKey} item`;
  addBtn.addEventListener("click", () => {
    const index = items.querySelectorAll(":scope > .rsu-config-array-item").length;
    appendArrayItem(items, prefix, index, itemSchema, {}, ctx);
    ctx.onChange?.();
  });
  body.appendChild(addBtn);
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
  const section = makeSection(labelKey, node.description);
  section.classList.add("rsu-config-map");
  section.dataset.mapKey = prefix;
  applyFlags(section, node, ctx);
  applySectionState(section, false);
  const body = sectionBody(section);

  const entries = document.createElement("div");
  entries.className = "rsu-config-map-entries";
  body.appendChild(entries);

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
    ctx.onChange?.();
  });
  body.appendChild(addBtn);
  return section;
}

/**
 * Render one `name → value` entry of a map.
 *
 * When `ctx.componentId` is set the key is auto-derived rather than
 * requiring manual entry: existing entries keep their stored key (displayed
 * read-only), and new entries default to the component id.  Without it the
 * key remains an editable input — the key *is* configuration (a Langfuse
 * project name, an OpenRouter key alias).  Renaming it re-stamps the
 * `data-key` path of every field below it, which is what keeps the
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
  const entryName = name || ctx.componentId || "";
  const isDerived = ctx.componentId !== undefined;

  const entry = document.createElement("div");
  entry.className = "rsu-config-array-item rsu-config-map-entry";
  entry.dataset.mapPrefix = prefix;
  entry.dataset.mapName = entryName;

  const header = document.createElement("div");
  header.className = "rsu-config-array-item-header rsu-config-map-entry-header";
  if (isDerived) {
    header.innerHTML = `<span class="rsu-config-map-name">${escHtml(entryName)}</span>`;
  } else {
    header.innerHTML =
      `<input type="text" class="rsu-config-map-name" value="${escAttr(entryName)}"` +
      ' spellcheck="false" placeholder="name">';
  }
  entry.appendChild(header);

  const body = document.createElement("div");
  body.className = "rsu-config-array-item-body";
  entry.appendChild(body);

  const renderBody = (entryName: string) => {
    body.innerHTML = "";
    const path = `${prefix}.${entryName}`;
    if (isObjectNode(valueSchema)) {
      // When componentId is set, auto-populate a project_id field inside an
      // object-valued map entry so the operator doesn't maintain it by hand.
      let entryValue = value;
      if (
        ctx.componentId &&
        isPlainObject(valueSchema.properties) &&
        "project_id" in valueSchema.properties
      ) {
        entryValue = {
          ...(isPlainObject(entryValue) ? entryValue : {}),
          project_id: ctx.componentId,
        };
      }
      renderNode(valueSchema, entryValue, path, body, ctx);
    } else {
      body.appendChild(buildRow(path, "value", valueSchema, value, [], ctx));
    }
  };
  renderBody(entryName);

  if (!isDerived) {
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
  }

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
