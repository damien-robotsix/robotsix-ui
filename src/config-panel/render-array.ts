/**
 * Repeatable "list of objects" sections: a collapsible section with an
 * add-button and one removable, renumbered item per array element.  Each item
 * renders its object schema through the shared {@link renderNode} orchestrator.
 */

import { escHtml } from "./html.js";
import { isPlainObject } from "./schema.js";
import {
  applyFlags,
  applySectionState,
  makeSection,
  sectionBody,
  type RenderContext,
} from "./section-state.js";
import type { JsonSchemaNode } from "./types.js";
import { renderNode } from "./render.js";

export function buildArraySection(
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
