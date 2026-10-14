/**
 * The shared Settings panel.
 *
 * Mount it and a component gets the whole affordance the standard requires:
 * typed inputs from the committed schema, collapsible settings groups, masked
 * secrets with merge-on-write, changed-keys-only saves, inline `422` messages,
 * and a version history with rollback (config-ownership.md, "Standard UI
 * affordance").
 */

import { ConfigClient, type ConfigClientOptions } from "./client.js";
import { collectConfigValues, diffConfigValues } from "./collect.js";
import { escHtml } from "./html.js";
import { clearFieldErrors, renderConfigForm, showFieldError } from "./render.js";
import type {
  ConfigFormOptions,
  ConfigResponse,
  ConfigSchema,
  ConfigValues,
  ConfigVersion,
  ConfigWriteResponse,
  DeployPlane,
} from "./types.js";
import { ConfigContractError, ConfigValidationError } from "./types.js";

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

/**
 * DOM refs and shared state threaded through the panel controller.
 *
 * The controller never touches the container or the static header setup —
 * only these references — so each behaviour stays independently testable.
 */
interface PanelContext {
  root: HTMLElement;
  client: ConfigClient;
  plane: DeployPlane;
  onSaved?: (result: ConfigWriteResponse) => void;
  formEl: HTMLElement;
  banner: HTMLElement;
  saveBtn: HTMLButtonElement;
  versionEl: HTMLElement;
  historyBody: HTMLElement;
  schema: ConfigSchema;
  loaded: ConfigValues;
  componentId?: string;
}

/**
 * The panel's stateful behaviours, extracted from `mountConfigPanel`.
 *
 * Holds the DOM refs and the current `schema`/`loaded` state so each action
 * (reload, save, rollback, history, tab switching) is a method rather than a
 * nested closure, and independently testable without building the full panel.
 */
class ConfigPanelController {
  private readonly client: ConfigClient;
  private readonly plane: DeployPlane;
  private readonly onSaved?: (result: ConfigWriteResponse) => void;
  private readonly root: HTMLElement;
  private readonly formEl: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly saveBtn: HTMLButtonElement;
  private readonly versionEl: HTMLElement;
  private readonly historyBody: HTMLElement;
  private readonly componentId?: string;
  private schema: ConfigSchema;
  private loaded: ConfigValues;

  constructor(ctx: PanelContext) {
    this.client = ctx.client;
    this.plane = ctx.plane;
    this.onSaved = ctx.onSaved;
    this.root = ctx.root;
    this.formEl = ctx.formEl;
    this.banner = ctx.banner;
    this.saveBtn = ctx.saveBtn;
    this.versionEl = ctx.versionEl;
    this.historyBody = ctx.historyBody;
    this.componentId = ctx.componentId;
    this.schema = ctx.schema;
    this.loaded = ctx.loaded;
  }

  /** Re-fetch config and re-render the form, discarding unsaved edits. */
  async reload(): Promise<void> {
    try {
      const response = await this.client.getConfig();
      this.renderForm(response);
      this.hideBanner();
    } catch (err) {
      this.showBanner(`Failed to load config: ${message(err)}`, "error");
    }
  }

  /** Save the changed keys.  Resolves `false` when validation rejected them. */
  async save(): Promise<boolean> {
    clearFieldErrors(this.formEl);
    this.hideBanner();
    this.saveBtn.disabled = true;
    const entered = collectConfigValues(this.schema, this.formEl, { plane: this.plane });
    const updates = diffConfigValues(this.loaded, entered, this.schema);
    if (Object.keys(updates).length === 0) {
      this.showBanner("No changes to save.", "success");
      return true;
    }
    try {
      const result = await this.client.putConfig(updates);
      this.renderForm({ config: result.config, schema: this.schema, version: result.version });
      this.showBanner(`Saved — now at version ${result.version}.`, "success");
      this.onSaved?.(result);
      return true;
    } catch (err) {
      this.saveBtn.disabled = false;
      if (err instanceof ConfigValidationError) {
        const placed = err.key ? showFieldError(this.formEl, err.key, err.message) : false;
        if (!placed) this.showBanner(err.message, "error");
      } else if (err instanceof ConfigContractError) {
        // The write itself was accepted — only the response is off-contract,
        // so re-read rather than re-rendering from a document we do not have.
        this.showBanner(`Saved, but ${err.message}. Re-reading the config.`, "error");
        void this.reload();
        return true;
      } else {
        this.showBanner(`Save failed: ${message(err)}`, "error");
      }
      return false;
    }
  }

  /** Re-fetch and render the version history. */
  async loadHistory(): Promise<void> {
    this.historyBody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
    try {
      const { versions } = await this.client.getVersions();
      this.renderHistory(versions || []);
    } catch (err) {
      this.historyBody.innerHTML = `<tr><td colspan="4">${escHtml(message(err))}</td></tr>`;
    }
  }

  /** Roll back to *version*, re-rendering the form on success. */
  async rollback(version: number): Promise<void> {
    try {
      const result = await this.client.rollback(version);
      this.renderForm({ config: result.config, schema: this.schema, version: result.version });
      this.showBanner(`Rolled back — now at version ${result.version}.`, "success");
      this.onSaved?.(result);
      this.selectTab("fields");
    } catch (err) {
      this.showBanner(`Rollback failed: ${message(err)}`, "error");
    }
  }

  /**
   * Render *response* into the form, resetting schema/loaded and the save button.
   *
   * Throws {@link ConfigContractError} when the payload carries no `config`
   * document: rendering one anyway means every field falls back to its schema
   * default, and the operator's next Save writes those defaults over the live
   * config.
   */
  renderForm(response: ConfigResponse): void {
    const loaded: unknown = response.config;
    if (typeof loaded !== "object" || loaded === null || Array.isArray(loaded)) {
      throw new ConfigContractError("GET /config", 'no "config" object in the response');
    }
    this.schema = response.schema;
    this.loaded = loaded as ConfigValues;
    renderConfigForm(this.formEl, this.schema, this.loaded, {
      plane: this.plane,
      componentId: this.componentId,
      onChange: () => {
        this.saveBtn.disabled = false;
      },
    });
    this.versionEl.textContent = response.version ? `version ${response.version}` : "";
    this.saveBtn.disabled = true;
  }

  /** Render *versions* into the history table. */
  renderHistory(versions: ConfigVersion[]): void {
    if (versions.length === 0) {
      this.historyBody.innerHTML = '<tr><td colspan="4">No previous versions.</td></tr>';
      return;
    }
    this.historyBody.innerHTML = versions
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

  /** Switch the visible tab, loading history the first time it is shown. */
  selectTab(name: string): void {
    this.root.querySelectorAll(".rsu-config-tab").forEach((el) => {
      el.classList.toggle("rsu-config-tab--active", (el as HTMLElement).dataset.tab === name);
    });
    this.root.querySelectorAll(".rsu-config-tabpanel").forEach((el) => {
      (el as HTMLElement).hidden = (el as HTMLElement).dataset.tab !== name;
    });
    if (name === "history") void this.loadHistory();
  }

  private showBanner(contents: string, kind: "error" | "success") {
    this.banner.textContent = contents;
    this.banner.className = `rsu-config-banner rsu-config-banner--${kind}`;
    this.banner.hidden = false;
  }

  private hideBanner() {
    this.banner.hidden = true;
  }
}

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
  const saveBtn = root.querySelector(".rsu-config-save") as HTMLButtonElement;
  const versionEl = root.querySelector(".rsu-config-version") as HTMLElement;
  const historyBody = root.querySelector(".rsu-config-history tbody") as HTMLElement;

  titleEl.textContent = options.title || "Settings";
  if (!showHistory) {
    (root.querySelector('.rsu-config-tab[data-tab="history"]') as HTMLElement).hidden = true;
  }

  const panel = new ConfigPanelController({
    root,
    client,
    plane,
    onSaved: options.onSaved,
    componentId: options.componentId,
    formEl,
    banner,
    saveBtn,
    versionEl,
    historyBody,
    schema: { type: "object", properties: {} },
    loaded: {},
  });

  root.querySelectorAll(".rsu-config-tab").forEach((el) => {
    el.addEventListener("click", () =>
      panel.selectTab((el as HTMLElement).dataset.tab || "fields"),
    );
  });
  saveBtn.addEventListener("click", () => void panel.save());
  historyBody.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest(".rsu-config-rollback");
    if (!target) return;
    void panel.rollback(Number((target as HTMLElement).dataset.version));
  });

  panel.selectTab("fields");
  if (options.initial) {
    panel.renderForm(options.initial);
  } else {
    void panel.reload();
  }

  return {
    element: root,
    reload: () => panel.reload(),
    save: () => panel.save(),
    destroy: () => {
      container.innerHTML = "";
    },
  };
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
