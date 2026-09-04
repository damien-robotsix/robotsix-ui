/**
 * Open-ended `name → value` map sections: a collapsible section with an
 * add-button and one removable entry per key.  An entry's value renders through
 * the shared {@link renderNode} orchestrator (object values) or a single
 * {@link buildRow} (scalar values); renaming an editable key re-stamps the
 * `data-key` paths of every field below it.
 */

import { escAttr, escHtml } from "./html.js";
import { isObjectNode, isPlainObject } from "./schema.js";
import {
  applyFlags,
  applySectionState,
  makeSection,
  sectionBody,
  type RenderContext,
} from "./section-state.js";
import type { JsonSchemaNode } from "./types.js";
import { renderNode } from "./render.js";
import { buildRow } from "./render-rows.js";

export function buildMapSection(
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
