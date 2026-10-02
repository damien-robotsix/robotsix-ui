import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigClient } from "./client.js";
import { mountConfigPanel } from "./panel.js";
import { ConfigContractError, ConfigValidationError } from "./types.js";

const schema = {
  type: "object",
  properties: {
    log_level: { type: "string", enum: ["info", "debug"], default: "info" },
    api_key: { type: "string", format: "password", writeOnly: true },
    workers: { type: "integer", default: 4 },
  },
};

function fakeClient(overrides: Record<string, unknown> = {}): ConfigClient {
  return {
    getConfig: vi.fn().mockResolvedValue({
      config: { log_level: "info", api_key: "**********", workers: 4 },
      schema,
      version: 7,
    }),
    putConfig: vi.fn().mockResolvedValue({ config: { log_level: "debug" }, version: 8 }),
    getVersions: vi.fn().mockResolvedValue({
      versions: [{ version: 7, timestamp: "2026-07-22T14:30:00Z", changed_keys: ["log_level"] }],
    }),
    rollback: vi.fn().mockResolvedValue({ config: { log_level: "info" }, version: 9 }),
    ...overrides,
  } as unknown as ConfigClient;
}

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  sessionStorage.clear();
});

/** Let the panel's in-flight load/save promises settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("mountConfigPanel", () => {
  it("loads the config surface and renders the form", async () => {
    const client = fakeClient();
    mountConfigPanel(host, { client });
    await settle();

    expect(client.getConfig).toHaveBeenCalled();
    expect(host.querySelector('[data-key="log_level"]')).not.toBeNull();
    expect(host.querySelector(".rsu-config-version")?.textContent).toBe("version 7");
    // Nothing edited yet, so there is nothing to save.
    expect((host.querySelector(".rsu-config-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends only the changed keys", async () => {
    const client = fakeClient();
    const panel = mountConfigPanel(host, { client });
    await settle();

    (host.querySelector('[data-key="log_level"]') as HTMLSelectElement).value = "debug";
    await panel.save();

    expect(client.putConfig).toHaveBeenCalledWith({ log_level: "debug" });
  });

  it("does not resend an untouched secret", async () => {
    const client = fakeClient();
    const panel = mountConfigPanel(host, { client });
    await settle();

    (host.querySelector('[data-key="log_level"]') as HTMLSelectElement).value = "debug";
    await panel.save();

    const sent = (client.putConfig as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0];
    expect(sent).not.toHaveProperty("api_key");
  });

  it("shows a validation failure on the offending field", async () => {
    const client = fakeClient({
      putConfig: vi
        .fn()
        .mockRejectedValue(new ConfigValidationError({ detail: "log_level: not a valid choice" })),
    });
    const panel = mountConfigPanel(host, { client });
    await settle();

    (host.querySelector('[data-key="log_level"]') as HTMLSelectElement).value = "debug";
    const saved = await panel.save();

    expect(saved).toBe(false);
    expect(host.querySelector(".rsu-config-error")?.textContent).toBe(
      "log_level: not a valid choice",
    );
    // The operator can retry without re-editing.
    expect((host.querySelector(".rsu-config-save") as HTMLButtonElement).disabled).toBe(false);
  });

  it("falls back to a banner when the failure names no field", async () => {
    const client = fakeClient({
      putConfig: vi.fn().mockRejectedValue(new ConfigValidationError({ detail: "nope" })),
    });
    const panel = mountConfigPanel(host, { client });
    await settle();

    (host.querySelector('[data-key="log_level"]') as HTMLSelectElement).value = "debug";
    await panel.save();

    const banner = host.querySelector(".rsu-config-banner") as HTMLElement;
    expect(banner.hidden).toBe(false);
    expect(banner.textContent).toBe("nope");
  });

  it("renders every field without an advanced toggle", async () => {
    mountConfigPanel(host, { client: fakeClient() });
    await settle();

    const row = host
      .querySelector('[data-key="workers"]')
      ?.closest(".rsu-config-row") as HTMLElement;
    expect(row.hidden).toBe(false);
    expect(host.querySelector(".rsu-config-advanced-bar")).toBeNull();
    expect(host.querySelector(".rsu-config-advanced-toggle")).toBeNull();
  });

  it("lists version history and rolls back", async () => {
    const client = fakeClient();
    mountConfigPanel(host, { client });
    await settle();

    (host.querySelector('.rsu-config-tab[data-tab="history"]') as HTMLElement).click();
    await settle();

    expect(client.getVersions).toHaveBeenCalled();
    const rollbackBtn = host.querySelector(".rsu-config-rollback") as HTMLButtonElement;
    expect(rollbackBtn).not.toBeNull();

    rollbackBtn.click();
    await settle();
    expect(client.rollback).toHaveBeenCalledWith(7);
    expect(host.querySelector(".rsu-config-version")?.textContent).toBe("version 9");
  });

  it("reports a load failure instead of rendering an empty form", async () => {
    const client = fakeClient({ getConfig: vi.fn().mockRejectedValue(new Error("boom")) });
    mountConfigPanel(host, { client });
    await settle();

    const banner = host.querySelector(".rsu-config-banner") as HTMLElement;
    expect(banner.hidden).toBe(false);
    expect(banner.textContent).toContain("boom");
  });

  it("refuses to render a payload with no config document", async () => {
    // Rendering it would fill every field from the schema defaults, and the
    // operator's next Save would write those defaults over the live config.
    const client = fakeClient({
      getConfig: vi
        .fn()
        .mockRejectedValue(new ConfigContractError("GET /config", 'no "config" object')),
    });
    mountConfigPanel(host, { client });
    await settle();

    expect(host.querySelector('[data-key="log_level"]')).toBeNull();
    const banner = host.querySelector(".rsu-config-banner") as HTMLElement;
    expect(banner.hidden).toBe(false);
    expect(banner.textContent).toContain("config");
    expect((host.querySelector(".rsu-config-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("re-reads instead of re-rendering when a save answers off-contract", async () => {
    const client = fakeClient({
      putConfig: vi
        .fn()
        .mockRejectedValue(new ConfigContractError("PUT /config", 'no "config" object')),
    });
    const panel = mountConfigPanel(host, { client });
    await settle();

    (host.querySelector('[data-key="log_level"]') as HTMLSelectElement).value = "debug";
    const saved = await panel.save();
    await settle();

    // The write itself was accepted, so the panel re-reads rather than
    // rendering an empty document over the form.
    expect(saved).toBe(true);
    expect(client.getConfig).toHaveBeenCalledTimes(2);
    expect((host.querySelector('[data-key="log_level"]') as HTMLSelectElement).value).toBe("info");
  });

  it("skips the initial fetch when the config is supplied", async () => {
    const client = fakeClient();
    mountConfigPanel(host, {
      client,
      initial: { config: { log_level: "debug" }, schema, version: 3 },
    });

    expect(client.getConfig).not.toHaveBeenCalled();
    expect((host.querySelector('[data-key="log_level"]') as HTMLSelectElement).value).toBe("debug");
  });
});
