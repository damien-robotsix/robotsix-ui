/**
 * Field-row builders: turn one scalar schema node into its typed input row —
 * a masked secret, a raw-JSON list, an enum dropdown, a number, a checkbox or
 * a plain text field.  Each builder is a pure DOM factory, independently
 * testable, wired to the change callback through {@link wireRow}.
 */

import { escAttr, escHtml, renderInlineMarkdown } from "./html.js";
import { isSecretField, resolveRef } from "./schema.js";
import { applyFlags, type RenderContext } from "./section-state.js";
import type { JsonSchemaNode } from "./types.js";

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

export function buildRow(
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
