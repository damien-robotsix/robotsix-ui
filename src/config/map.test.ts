/**
 * Open-ended maps (`dict[str, …]`) — the shape of the component standard's
 * canonical credential blocks, whose keys are configuration rather than
 * schema.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { collectConfigValues, diffConfigValues } from "./collect.js";
import { renderConfigForm } from "./render.js";
import type { ConfigSchema } from "./types.js";

const schema: ConfigSchema = {
  type: "object",
  $defs: {
    LangfuseProject: {
      type: "object",
      properties: {
        public_key: { type: "string", default: "" },
        secret_key: { type: "string", format: "password", writeOnly: true, default: "" },
        project_id: { type: "string", default: "", advanced: true },
      },
    },
  },
  properties: {
    langfuse: {
      type: "object",
      properties: {
        host: { type: "string", default: "" },
        projects: {
          type: "object",
          description: "Langfuse project name → credentials",
          additionalProperties: { $ref: "#/$defs/LangfuseProject" },
          default: {},
        },
      },
    },
    openrouter: {
      type: "object",
      properties: {
        keys: {
          type: "object",
          additionalProperties: { type: "string", format: "password", writeOnly: true },
          default: {},
        },
      },
    },
  },
};

const current = {
  langfuse: {
    host: "https://langfuse.example.net",
    projects: {
      "robotsix-auto-mail": {
        public_key: "pk-lf-1",
        secret_key: "**********",
        project_id: "cm1",
      },
    },
  },
  openrouter: { keys: { "robotsix-auto-mail": "**********" } },
};

let container: HTMLElement;

function field(key: string): HTMLInputElement {
  const el = container.querySelector(`[data-key="${CSS.escape(key)}"]`);
  if (!el) throw new Error(`no field rendered for ${key}`);
  return el as HTMLInputElement;
}

function nameInput(index = 0): HTMLInputElement {
  return container.querySelectorAll<HTMLInputElement>(".rsu-config-map-name")[index];
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

describe("map rendering", () => {
  it("renders one keyed entry per map key, with the key editable", () => {
    renderConfigForm(container, schema, current);

    expect(nameInput().value).toBe("robotsix-auto-mail");
    expect(field("langfuse.projects.robotsix-auto-mail.public_key").value).toBe("pk-lf-1");
    expect(field("langfuse.projects.robotsix-auto-mail.secret_key").type).toBe("password");
  });

  it("renders a scalar-valued map as one row per entry", () => {
    renderConfigForm(container, schema, current);

    const key = field("openrouter.keys.robotsix-auto-mail");
    expect(key.type).toBe("password");
    // A stored secret is never echoed, but is reported as set.
    expect(key.value).toBe("");
    expect(key.closest(".rsu-config-row")?.textContent).toContain("set");
  });

  it("hides an advanced field inside a map entry", () => {
    renderConfigForm(container, schema, current);

    const row = field("langfuse.projects.robotsix-auto-mail.project_id").closest(
      ".rsu-config-row",
    ) as HTMLElement;
    expect(row.hidden).toBe(true);
  });

  it("adds and removes entries", () => {
    renderConfigForm(container, schema, current);
    const projects = container.querySelector('[data-map-key="langfuse.projects"]') as HTMLElement;
    const entries = () => projects.querySelectorAll(".rsu-config-map-entry").length;

    (projects.querySelector(".rsu-config-map-add") as HTMLButtonElement).click();
    expect(entries()).toBe(2);

    (projects.querySelectorAll(".rsu-config-array-remove")[1] as HTMLButtonElement).click();
    expect(entries()).toBe(1);
  });

  it("re-stamps field paths when an entry is renamed", () => {
    renderConfigForm(container, schema, current);

    const name = nameInput();
    name.value = "robotsix-auto-mail-triage";
    name.dispatchEvent(new Event("input"));

    expect(field("langfuse.projects.robotsix-auto-mail-triage.public_key").value).toBe("pk-lf-1");
  });
});

describe("map collection", () => {
  it("collects entries keyed by name, omitting an untouched secret", () => {
    renderConfigForm(container, schema, current);

    const collected = collectConfigValues(schema, container);

    expect(collected.langfuse).toEqual({
      host: "https://langfuse.example.net",
      projects: {
        "robotsix-auto-mail": { public_key: "pk-lf-1", project_id: "cm1" },
      },
    });
    // A blank scalar secret keeps its alias rather than reading as a removal.
    expect(collected.openrouter).toEqual({ keys: { "robotsix-auto-mail": "" } });
  });

  it("collects a newly typed entry", () => {
    renderConfigForm(container, schema, current);
    (container.querySelector(".rsu-config-map-add") as HTMLButtonElement).click();

    const added = nameInput(1);
    added.value = "robotsix-auto-mail-triage";
    added.dispatchEvent(new Event("input"));
    const secret = field("langfuse.projects.robotsix-auto-mail-triage.secret_key");
    secret.value = "sk-lf-new";

    const collected = collectConfigValues(schema, container) as {
      langfuse: { projects: Record<string, unknown> };
    };
    expect(collected.langfuse.projects["robotsix-auto-mail-triage"]).toEqual({
      secret_key: "sk-lf-new",
    });
  });

  it("skips an entry whose name is still blank", () => {
    renderConfigForm(container, schema, current);
    (container.querySelector(".rsu-config-map-add") as HTMLButtonElement).click();

    const collected = collectConfigValues(schema, container) as {
      langfuse: { projects: Record<string, unknown> };
    };
    expect(Object.keys(collected.langfuse.projects)).toEqual(["robotsix-auto-mail"]);
  });
});

describe("diffing a map", () => {
  it("sends the whole map when an entry is removed", () => {
    renderConfigForm(container, schema, current);
    (container.querySelectorAll(".rsu-config-array-remove")[0] as HTMLButtonElement).click();

    const entered = collectConfigValues(schema, container);
    const updates = diffConfigValues(current, entered, schema) as {
      langfuse: { projects: Record<string, unknown> };
    };

    expect(updates.langfuse.projects).toEqual({});
  });

  it("resends a map whose secret was not retyped, and nothing else", () => {
    renderConfigForm(container, schema, current);

    const entered = collectConfigValues(schema, container);
    const updates = diffConfigValues(current, entered, schema);

    // The map differs from the stored one only by the masked secret the panel
    // never echoes, so it is resent whole — the surface merges a blank secret
    // back to the stored value.  `langfuse.host`, a plain scalar, is untouched
    // and must not appear.
    expect(updates).toEqual({
      langfuse: {
        projects: {
          "robotsix-auto-mail": { public_key: "pk-lf-1", project_id: "cm1" },
        },
      },
      openrouter: { keys: { "robotsix-auto-mail": "" } },
    });
  });
});
