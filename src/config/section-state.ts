/**
 * Collapsible-section construction and per-session collapse-state persistence.
 *
 * These helpers back every group header the config form renders: building the
 * toggle-button section shell, remembering which sections the operator opened
 * or closed for the rest of the session, and flagging sections/rows owned by
 * the other deploy plane as read-only.
 */

import { renderInlineMarkdown } from "./html.js";
import { fieldPlane } from "./schema.js";
import type { DeployPlane, JsonSchemaNode } from "./types.js";

/** Marks a row/section owned by the other plane — rendered read-only. */
export const FOREIGN_CLASS = "rsu-config-foreign";
/** Marks a section whose header toggles its body open and shut. */
export const COLLAPSIBLE_SECTION_CLASS = "rsu-config-section--collapsible";
/** Marks a collapsible section that is currently collapsed. */
export const SECTION_COLLAPSED_CLASS = "rsu-config-section--collapsed";

/** Ambient render state threaded through every builder. */
export interface RenderContext {
  plane: DeployPlane;
  defs: Record<string, JsonSchemaNode> | undefined;
  onChange?: () => void;
  componentId?: string;
}

/** The section's header label, used as its stable per-session key. */
export function sectionTitle(section: HTMLElement): string {
  const toggle = section.querySelector(".rsu-config-section-toggle");
  return (toggle as HTMLElement | null)?.textContent?.trim() ?? "";
}

const SECTION_STATE_PREFIX = "rsu-config:section:";

/**
 * The session-persisted collapsed flag for *title*, or `null` when the
 * operator has not touched that section this session.
 */
export function loadSectionCollapsed(title: string): boolean | null {
  try {
    const raw = sessionStorage.getItem(SECTION_STATE_PREFIX + title);
    return raw === null ? null : raw === "1";
  } catch {
    // Storage unavailable (private mode, SSR): collapse state just won't persist.
    return null;
  }
}

/** Persist a group header's open/closed choice for the rest of the session. */
export function saveSectionCollapsed(title: string, collapsed: boolean): void {
  try {
    if (collapsed) sessionStorage.setItem(SECTION_STATE_PREFIX + title, "1");
    else sessionStorage.removeItem(SECTION_STATE_PREFIX + title);
  } catch {
    // Non-fatal: same as loadSectionCollapsed.
  }
}

/** Build a collapsible section with a toggle-button header and a body element. */
export function makeSection(title: string, description?: string): HTMLElement {
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
export function sectionBody(section: HTMLElement): HTMLElement {
  return section.querySelector(".rsu-config-section-body") as HTMLElement;
}

/**
 * Set a section's collapsed state, applying the per-session preference when
 * present, else *defaultCollapsed*.
 */
export function applySectionState(section: HTMLElement, defaultCollapsed: boolean): void {
  const stored = loadSectionCollapsed(sectionTitle(section));
  const collapsed = stored !== null ? stored : defaultCollapsed;
  setSectionCollapsed(section, collapsed);
}

/** Toggle *section*'s collapsed class and the toggle button's `aria-expanded`. */
export function setSectionCollapsed(section: HTMLElement, collapsed: boolean): void {
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

/**
 * Flag *el* as foreign (read-only) when its schema node belongs to the other
 * deploy plane, and report whether it did.
 */
export function applyFlags(el: HTMLElement, node: JsonSchemaNode, ctx: RenderContext): boolean {
  const foreign = fieldPlane(node) !== ctx.plane;
  if (foreign) el.classList.add(FOREIGN_CLASS);
  return foreign;
}
