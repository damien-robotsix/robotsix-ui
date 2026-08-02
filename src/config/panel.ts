/**
 * The shared Settings panel.
 *
 * Mount it and a component gets the whole affordance the standard requires:
 * typed inputs from the committed schema, an advanced toggle, masked secrets
 * with merge-on-write, changed-keys-only saves, inline `422` messages, and a
 * version history with rollback (config-ownership.md, "Standard UI affordance").
 */

import { ConfigClient, type ConfigClientOptions } from "./client.js";
import { collectConfigValues, diffConfigValues } from "./collect.js";
import { escHtml } from "./html.js";
import {
  clearFieldErrors,
  hasAdvancedFields,
  renderConfigForm,
  setAdvancedVisible,
  showFieldError,
} from "./render.js";
import type {
  ConfigFormOptions,
  ConfigResponse,
  ConfigSchema,
  ConfigValues,
  ConfigVersion,
  ConfigWriteResponse,
} from "./types.js";
import { ConfigValidationError } from "./types.js";

/** Options for {@link mountConfigPanel}. */
export interface ConfigPanelOptions extends ConfigClientOptions, ConfigFormOptions {
  /** Pre-built client.  When omitted one is built from the client options. */
  client?: ConfigClient;
  /** Heading shown above the form.  Defaults to "Settings". */
  title?: string;
  /** Show the version-history tab.  Defaults to `true`. */
  history?: boolean;
  /** Skip the initial `GET /config` by supplying the response directly. */
  initial?: ConfigResponse;
  /** Called after a successful save or rollback. */
  onSaved?: (result: ConfigWriteResponse) => void;
}

/** Handle returned by {@link mountConfigPanel}. */
export interface ConfigPanelHandle {
  /** The panel's root element. */
  readonly element: HTMLElement;
  /** Re-fetch config and re-render the form, discarding unsaved edits. */
  reload(): Promise<void>;
  /** Save the changed keys.  Resolves `false` when validation rejected them. */
  save(): Promise<boolean>;
  /** Remove the panel from the DOM. */
  destroy(): void;
}

const PANEL_HTML = `
<div class="rsu-config-panel">
  <div class="rsu-config-panel-header">
    <h2 class="rsu-config-panel-title"></h2>
    <div class="rsu-config-panel-tabs" role="tablist">
      <button type="button" class="rsu-config-tab" data-tab="fields" role="tab">Settings</button>
      <button type="button" class="rsu-config-tab" data-tab="history" role="tab">History</button>
    </div>
  </div>
  <div class="rsu-config-banner" hidden></div>
  <div class="rsu-config-tabpanel" data-tab="fields">
    <label class="rsu-config-advanced-bar" hidden>
      <input type="checkbox" class="rsu-config-advanced-toggle">
      Show advanced settings
    </label>
    <div class="rsu-config-form"></div>
    <div class="rsu-config-actions">
      <button type="button" class="rsu-btn rsu-config-save" disabled>Save</button>
      <span class="rsu-config-version"></span>
    </div>
  </div>
  <div class="rsu-config-tabpanel" data-tab="history" hidden>
    <table class="rsu-config-history">
      <thead><tr><th>Version</th><th>When</th><th>Changed keys</th><th></th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
</div>
`;

/** Render a Settings panel into *container* and start loading its config. */
export function mountConfigPanel(
  container: HTMLElement,
  options: ConfigPanelOptions = {},
): ConfigPanelHandle {
  const client = options.client || new ConfigClient(options);
  const plane = options.plane || "component";
  const showHistory = options.history !== false;

  container.innerHTML = PANEL_HTML;
  const root = container.querySelector(".rsu-config-panel") as HTMLElement;
  const titleEl = root.querySelector(".rsu-config-panel-title") as HTMLElement;
  const banner = root.querySelector(".rsu-config-banner") as HTMLElement;
  const formEl = root.querySelector(".rsu-config-form") as HTMLElement;
  const advancedBar = root.querySelector(".rsu-config-advanced-bar") as HTMLElement;
  const advancedToggle = root.querySelector(".rsu-config-advanced-toggle") as HTMLInputElement;
  const saveBtn = root.querySelector(".rsu-config-save") as HTMLButtonElement;
  const versionEl = root.querySelector(".rsu-config-version") as HTMLElement;
  const historyBody = root.querySelector(".rsu-config-history tbody") as HTMLElement;

  titleEl.textContent = options.title || "Settings";
  if (!showHistory) {
    (root.querySelector('.rsu-config-tab[data-tab="history"]') as HTMLElement).hidden = true;
  }

  let schema: ConfigSchema = { type: "object", properties: {} };
  let loaded: ConfigValues = {};

  function showBanner(message: string, kind: "error" | "success") {
    banner.textContent = message;
    banner.className = `rsu-config-banner rsu-config-banner--${kind}`;
    banner.hidden = false;
  }

  function hideBanner() {
    banner.hidden = true;
  }

  function selectTab(name: string) {
    root.querySelectorAll(".rsu-config-tab").forEach((el) => {
      el.classList.toggle("rsu-config-tab--active", (el as HTMLElement).dataset.tab === name);
    });
    root.querySelectorAll(".rsu-config-tabpanel").forEach((el) => {
      (el as HTMLElement).hidden = (el as HTMLElement).dataset.tab !== name;
    });
    if (name === "history") void loadHistory();
  }

  function renderForm(response: ConfigResponse) {
    schema = response.schema;
    loaded = response.config || {};
    renderConfigForm(formEl, schema, loaded, {
      plane,
      onChange: () => {
        saveBtn.disabled = false;
      },
    });
    advancedBar.hidden = !hasAdvancedFields(formEl);
    advancedToggle.checked = false;
    versionEl.textContent = response.version ? `version ${response.version}` : "";
    saveBtn.disabled = true;
  }

  async function reload() {
    try {
      const response = await client.getConfig();
      renderForm(response);
      hideBanner();
    } catch (err) {
      showBanner(`Failed to load config: ${message(err)}`, "error");
    }
  }

  async function save(): Promise<boolean> {
    clearFieldErrors(formEl);
    hideBanner();
    saveBtn.disabled = true;
    const entered = collectConfigValues(schema, formEl, { plane });
    const updates = diffConfigValues(loaded, entered);
    if (Object.keys(updates).length === 0) {
      showBanner("No changes to save.", "success");
      return true;
    }
    try {
      const result = await client.putConfig(updates);
      renderForm({ config: result.config, schema, version: result.version });
      showBanner(`Saved — now at version ${result.version}.`, "success");
      options.onSaved?.(result);
      return true;
    } catch (err) {
      saveBtn.disabled = false;
      if (err instanceof ConfigValidationError) {
        const placed = err.key ? showFieldError(formEl, err.key, err.message) : false;
        if (!placed) showBanner(err.message, "error");
      } else {
        showBanner(`Save failed: ${message(err)}`, "error");
      }
      return false;
    }
  }

  async function loadHistory() {
    historyBody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
    try {
      const { versions } = await client.getVersions();
      renderHistory(versions || []);
    } catch (err) {
      historyBody.innerHTML = `<tr><td colspan="4">${escHtml(message(err))}</td></tr>`;
    }
  }

  function renderHistory(versions: ConfigVersion[]) {
    if (versions.length === 0) {
      historyBody.innerHTML = '<tr><td colspan="4">No previous versions.</td></tr>';
      return;
    }
    historyBody.innerHTML = versions
      .map(
        (entry) =>
          "<tr>" +
          `<td>${escHtml(entry.version)}</td>` +
          `<td>${escHtml(entry.timestamp)}</td>` +
          `<td>${escHtml((entry.changed_keys || []).join(", "))}</td>` +
          '<td><button type="button" class="rsu-config-rollback" ' +
          `data-version="${escHtml(entry.version)}">Roll back</button></td>` +
          "</tr>",
      )
      .join("");
  }

  async function rollback(version: number) {
    try {
      const result = await client.rollback(version);
      renderForm({ config: result.config, schema, version: result.version });
      showBanner(`Rolled back — now at version ${result.version}.`, "success");
      options.onSaved?.(result);
      selectTab("fields");
    } catch (err) {
      showBanner(`Rollback failed: ${message(err)}`, "error");
    }
  }

  root.querySelectorAll(".rsu-config-tab").forEach((el) => {
    el.addEventListener("click", () => selectTab((el as HTMLElement).dataset.tab || "fields"));
  });
  advancedToggle.addEventListener("change", () =>
    setAdvancedVisible(formEl, advancedToggle.checked),
  );
  saveBtn.addEventListener("click", () => void save());
  historyBody.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest(".rsu-config-rollback");
    if (!target) return;
    void rollback(Number((target as HTMLElement).dataset.version));
  });

  selectTab("fields");
  if (options.initial) {
    renderForm(options.initial);
  } else {
    void reload();
  }

  return {
    element: root,
    reload,
    save,
    destroy: () => {
      container.innerHTML = "";
    },
  };
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
