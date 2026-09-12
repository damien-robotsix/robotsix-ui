/**
 * Unit tests for section-state.ts — per-session collapse persistence, the
 * collapsible-section shell, and foreign-plane read-only flagging.
 *
 * render.test.ts / map.test.ts only verify the DOM class/aria toggle on a
 * single click; these tests cover the persistence round-trip
 * (`saveSectionCollapsed` → `loadSectionCollapsed` → `applySectionState`), the
 * sessionStorage-unavailable fallback (private-mode / SSR), `applyFlags`
 * foreign-plane detection, and `renderDescription` long/multiline truncation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderConfigForm } from "./render.js";
import {
  applyFlags,
  applySectionState,
  COLLAPSIBLE_SECTION_CLASS,
  FOREIGN_CLASS,
  loadSectionCollapsed,
  makeSection,
  saveSectionCollapsed,
  SECTION_COLLAPSED_CLASS,
  sectionBody,
  sectionTitle,
  setSectionCollapsed,
  type RenderContext,
} from "./section-state.js";
import type { ConfigSchema, JsonSchemaNode } from "./types.js";

const groupedSchema: ConfigSchema = {
  type: "object",
  properties: {
    retry_interval_s: { type: "integer", default: 5, group: "Mailbox" },
    host: { type: "string", default: "imap.example.com", group: "Mailbox" },
  },
};

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  sessionStorage.clear();
});

afterEach(() => {
  container.remove();
  vi.restoreAllMocks();
});

function sectionByTitle(title: string): HTMLElement {
  const sections = [...container.querySelectorAll<HTMLElement>(".rsu-config-section")];
  const section = sections.find(
    (s) => s.querySelector(".rsu-config-section-toggle")?.textContent === title,
  );
  if (!section) throw new Error(`no section titled "${title}"`);
  return section;
}

describe("loadSectionCollapsed / saveSectionCollapsed", () => {
  it("returns null when the operator has not touched the section this session", () => {
    expect(loadSectionCollapsed("Mailbox")).toBeNull();
  });

  it("round-trips a collapsed choice against sessionStorage", () => {
    saveSectionCollapsed("Mailbox", true);
    expect(sessionStorage.getItem("rsu-config:section:Mailbox")).toBe("1");
    expect(loadSectionCollapsed("Mailbox")).toBe(true);
  });

  it("removes the stored flag when a section is expanded again", () => {
    saveSectionCollapsed("Mailbox", true);
    saveSectionCollapsed("Mailbox", false);
    expect(sessionStorage.getItem("rsu-config:section:Mailbox")).toBeNull();
    expect(loadSectionCollapsed("Mailbox")).toBeNull();
  });

  it("treats a stored non-'1' value as expanded", () => {
    sessionStorage.setItem("rsu-config:section:Mailbox", "0");
    expect(loadSectionCollapsed("Mailbox")).toBe(false);
  });

  it("keys persistence by the section title", () => {
    saveSectionCollapsed("Mailbox", true);
    expect(loadSectionCollapsed("Network")).toBeNull();
  });
});

describe("sessionStorage unavailable (private-mode / SSR fallback)", () => {
  it("loadSectionCollapsed falls back to null when reads throw", () => {
    vi.spyOn(sessionStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => loadSectionCollapsed("Mailbox")).not.toThrow();
    expect(loadSectionCollapsed("Mailbox")).toBeNull();
  });

  it("saveSectionCollapsed becomes a silent no-op when writes throw", () => {
    vi.spyOn(sessionStorage, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(sessionStorage, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => saveSectionCollapsed("Mailbox", true)).not.toThrow();
    expect(() => saveSectionCollapsed("Mailbox", false)).not.toThrow();
  });
});

describe("makeSection", () => {
  it("builds a collapsible section with a toggle header and a body", () => {
    const section = makeSection("Mailbox");
    expect(section.classList.contains("rsu-config-section")).toBe(true);
    expect(section.classList.contains(COLLAPSIBLE_SECTION_CLASS)).toBe(true);
    const toggle = section.querySelector(".rsu-config-section-toggle");
    expect(toggle?.textContent).toBe("Mailbox");
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(section.querySelector(".rsu-config-section-body")).not.toBeNull();
  });

  it("omits the description block when none is given", () => {
    expect(makeSection("Mailbox").querySelector(".rsu-config-desc")).toBeNull();
  });
});

describe("sectionTitle / sectionBody", () => {
  it("derives the persistence key from the toggle text and exposes the body", () => {
    const section = makeSection("Mailbox");
    expect(sectionTitle(section)).toBe("Mailbox");
    expect(sectionBody(section)).toBe(section.querySelector(".rsu-config-section-body"));
  });
});

describe("setSectionCollapsed", () => {
  it("toggles the collapsed class and aria-expanded together", () => {
    const section = makeSection("Mailbox");

    setSectionCollapsed(section, true);
    expect(section.classList.contains(SECTION_COLLAPSED_CLASS)).toBe(true);
    expect(section.querySelector(".rsu-config-section-toggle")?.getAttribute("aria-expanded")).toBe(
      "false",
    );

    setSectionCollapsed(section, false);
    expect(section.classList.contains(SECTION_COLLAPSED_CLASS)).toBe(false);
    expect(section.querySelector(".rsu-config-section-toggle")?.getAttribute("aria-expanded")).toBe(
      "true",
    );
  });
});

describe("applySectionState", () => {
  it("prefers the stored per-session choice over the default", () => {
    saveSectionCollapsed("Mailbox", true);
    const section = makeSection("Mailbox");
    applySectionState(section, false);
    expect(section.classList.contains(SECTION_COLLAPSED_CLASS)).toBe(true);

    saveSectionCollapsed("Mailbox", false);
    const expanded = makeSection("Mailbox");
    applySectionState(expanded, true);
    expect(expanded.classList.contains(SECTION_COLLAPSED_CLASS)).toBe(false);
  });

  it("falls back to defaultCollapsed when nothing is stored", () => {
    const collapsed = makeSection("Mailbox");
    applySectionState(collapsed, true);
    expect(collapsed.classList.contains(SECTION_COLLAPSED_CLASS)).toBe(true);

    const expanded = makeSection("Mailbox");
    applySectionState(expanded, false);
    expect(expanded.classList.contains(SECTION_COLLAPSED_CLASS)).toBe(false);
  });
});

describe("persistence round-trip through renderConfigForm", () => {
  it("renders groups open by default when nothing is stored", () => {
    renderConfigForm(container, groupedSchema, {});
    expect(sectionByTitle("Mailbox").classList.contains(SECTION_COLLAPSED_CLASS)).toBe(false);
  });

  it("writes a collapsed choice on click and restores it on re-render", () => {
    renderConfigForm(container, groupedSchema, {});
    let section = sectionByTitle("Mailbox");
    const toggle = section.querySelector(".rsu-config-section-toggle") as HTMLElement;

    toggle.click();
    expect(section.classList.contains(SECTION_COLLAPSED_CLASS)).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(sessionStorage.getItem("rsu-config:section:Mailbox")).toBe("1");

    renderConfigForm(container, groupedSchema, {});
    section = sectionByTitle("Mailbox");
    expect(section.classList.contains(SECTION_COLLAPSED_CLASS)).toBe(true);
    expect(section.querySelector(".rsu-config-section-toggle")?.getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("re-expanding clears the stored flag and re-renders open", () => {
    renderConfigForm(container, groupedSchema, {});
    const section = sectionByTitle("Mailbox");
    const toggle = section.querySelector(".rsu-config-section-toggle") as HTMLElement;

    toggle.click(); // collapse
    toggle.click(); // expand
    expect(section.classList.contains(SECTION_COLLAPSED_CLASS)).toBe(false);
    expect(sessionStorage.getItem("rsu-config:section:Mailbox")).toBeNull();

    renderConfigForm(container, groupedSchema, {});
    expect(sectionByTitle("Mailbox").classList.contains(SECTION_COLLAPSED_CLASS)).toBe(false);
  });
});

describe("applyFlags", () => {
  const componentCtx: RenderContext = { plane: "component", defs: undefined };
  const deployCtx: RenderContext = { plane: "deploy", defs: undefined };

  it("flags a node owned by the other plane as foreign", () => {
    const deployNode: JsonSchemaNode = { type: "string", "x-deploy-plane": "deploy" };
    const el = document.createElement("div");
    expect(applyFlags(el, deployNode, componentCtx)).toBe(true);
    expect(el.classList.contains(FOREIGN_CLASS)).toBe(true);
  });

  it("leaves same-plane and unannotated nodes unflagged", () => {
    const deployNode: JsonSchemaNode = { type: "string", "x-deploy-plane": "deploy" };
    const samePlane = document.createElement("div");
    expect(applyFlags(samePlane, deployNode, deployCtx)).toBe(false);
    expect(samePlane.classList.contains(FOREIGN_CLASS)).toBe(false);

    const unannotated = document.createElement("div");
    expect(applyFlags(unannotated, { type: "string" }, componentCtx)).toBe(false);
    expect(unannotated.classList.contains(FOREIGN_CLASS)).toBe(false);
  });
});

describe("renderDescription", () => {
  it("renders a short description as a plain paragraph", () => {
    const section = makeSection("Mailbox", "Short help text.");
    expect(section.querySelector("p.rsu-config-desc")?.textContent).toBe("Short help text.");
    expect(section.querySelector(".rsu-config-desc-toggle")).toBeNull();
    expect(section.querySelector(".rsu-config-desc--collapsed")).toBeNull();
  });

  it("truncates a long single-line description and adds a 'more…' toggle", () => {
    const long = "a".repeat(141);
    const section = makeSection("Mailbox", long);
    expect(section.querySelector(".rsu-config-desc--collapsed")).not.toBeNull();
    expect(section.querySelector(".rsu-config-desc-short")?.textContent).toBe(
      "a".repeat(120) + "…",
    );
    expect(section.querySelector(".rsu-config-desc-toggle")?.textContent).toBe("more…");
    expect(section.querySelector(".rsu-config-desc-full")?.textContent).toContain("a");
  });

  it("treats a multiline description as long, showing only its first line as the short text", () => {
    const multi = "First line of a long description\nand the second line keeps going";
    const section = makeSection("Mailbox", multi);
    expect(section.querySelector(".rsu-config-desc--collapsed")).not.toBeNull();
    expect(section.querySelector(".rsu-config-desc-short")?.textContent).toBe(
      "First line of a long description",
    );
    expect(section.querySelector(".rsu-config-desc-full")?.textContent).toContain(
      "and the second line keeps going",
    );
    expect(section.querySelector(".rsu-config-desc-toggle")?.textContent).toBe("more…");
  });
});
