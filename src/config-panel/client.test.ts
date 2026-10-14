import { describe, it, expect, vi } from "vitest";
import { ConfigClient } from "./client.js";
import { ConfigContractError, ConfigValidationError, parseProblemKey } from "./types.js";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("ConfigClient", () => {
  it("reads the config surface", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ config: { log_level: "info" }, schema: {}, version: 7 }));
    const client = new ConfigClient({ baseUrl: "/api/", fetchImpl });

    const result = await client.getConfig();

    expect(result.version).toBe(7);
    // The trailing slash is normalised away rather than doubled.
    expect(fetchImpl.mock.calls[0][0]).toBe("/api/config");
    expect(fetchImpl.mock.calls[0][1].method).toBe("GET");
  });

  it("sends a partial update as JSON", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ config: { log_level: "debug" }, version: 8 }));
    const client = new ConfigClient({ fetchImpl, headers: { "X-API-Key": "k" } });

    const result = await client.putConfig({ log_level: "debug" });

    expect(result.version).toBe(8);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/config");
    expect(init.method).toBe("PUT");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["X-API-Key"]).toBe("k");
    expect(JSON.parse(init.body)).toEqual({ log_level: "debug" });
  });

  it("raises a typed error for a 422 problem document", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          type: "urn:robotsix:error:config-validation",
          title: "Config validation failed",
          detail: "retry_interval_s: value must be >= 1",
        },
        422,
      ),
    );
    const client = new ConfigClient({ fetchImpl });

    await expect(client.putConfig({ retry_interval_s: 0 })).rejects.toBeInstanceOf(
      ConfigValidationError,
    );

    const error = await client.putConfig({ retry_interval_s: 0 }).catch((err) => err);
    expect(error.key).toBe("retry_interval_s");
    expect(error.message).toBe("retry_interval_s: value must be >= 1");
  });

  it("surfaces other failures as plain errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null, 503));
    const client = new ConfigClient({ fetchImpl });

    await expect(client.getConfig()).rejects.toThrow("HTTP 503");
  });

  it("rolls back to a previous version", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ config: {}, version: 9 }));
    const client = new ConfigClient({ fetchImpl });

    await client.rollback(6);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/config/rollback");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ version: 6 });
  });
});

describe("ConfigClient contract enforcement", () => {
  // A component that spreads its config across the top level used to reach the
  // panel as an empty document, which renders every field at its schema
  // default — and the next Save writes those defaults over the live config.

  it("rejects a GET /config response with the document at the top level", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ log_level: "info", schema: {}, version: 7 }));
    const client = new ConfigClient({ fetchImpl });

    await expect(client.getConfig()).rejects.toBeInstanceOf(ConfigContractError);
    await expect(client.getConfig()).rejects.toThrow(/GET \/config/);
  });

  it("names the top-level keys it did see", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ log_level: "info", version: 7 }));
    const client = new ConfigClient({ fetchImpl });

    await expect(client.getConfig()).rejects.toThrow(/log_level, version/);
  });

  it("rejects a PUT /config response with no config document", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ version: 8, status: "ok" }));
    const client = new ConfigClient({ fetchImpl });

    await expect(client.putConfig({ log_level: "debug" })).rejects.toBeInstanceOf(
      ConfigContractError,
    );
  });

  it("rejects a rollback response with no config document", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ version: 9, status: "ok" }));
    const client = new ConfigClient({ fetchImpl });

    await expect(client.rollback(6)).rejects.toBeInstanceOf(ConfigContractError);
  });

  it("rejects a bare-list version history", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ version: 7 }]));
    const client = new ConfigClient({ fetchImpl });

    await expect(client.getVersions()).rejects.toBeInstanceOf(ConfigContractError);
  });
});

describe("parseProblemKey", () => {
  it("extracts the field a detail blames", () => {
    expect(parseProblemKey("retry_interval_s: value must be >= 1")).toBe("retry_interval_s");
    expect(parseProblemKey("imap.port: too small")).toBe("imap.port");
  });

  it("returns null when the detail is not field-scoped", () => {
    expect(parseProblemKey("Config validation failed")).toBeNull();
  });
});
