/**
 * Client for the standard component config HTTP surface.
 *
 * Every deployable component implements `GET /config`, `PUT /config`,
 * `GET /config/versions` and `POST /config/rollback` (config-ownership.md).
 * This client is the only place a UI needs to know about those routes.
 */

import type {
  ConfigProblem,
  ConfigResponse,
  ConfigValues,
  ConfigVersionsResponse,
  ConfigWriteResponse,
} from "./types.js";
import { ConfigContractError, ConfigValidationError } from "./types.js";

/** Return `true` when *value* is a plain JSON object. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Assert that *payload* carries a config document under `config`.
 *
 * A component that spreads its config across the top level (or omits it)
 * would otherwise hand the panel an empty document, which renders every field
 * at its schema default — and the next Save writes those defaults over the
 * live config.  Throwing here keeps a contract break loud and harmless.
 */
function assertConfigDocument(payload: unknown, route: string): void {
  if (!isObject(payload)) {
    throw new ConfigContractError(route, "the response body is not a JSON object");
  }
  if (!isObject(payload.config)) {
    const keys = Object.keys(payload).slice(0, 8).join(", ");
    throw new ConfigContractError(
      route,
      `no "config" object in the response (top-level keys: ${keys || "none"})`,
    );
  }
}

/** Options for {@link ConfigClient}. */
export interface ConfigClientOptions {
  /** Prefix for the config routes.  Defaults to same-origin root. */
  baseUrl?: string;
  /** Extra headers to send (auth tokens, CSRF). */
  headers?: Record<string, string>;
  /** Injectable fetch, for tests and non-browser hosts. */
  fetchImpl?: typeof fetch;
}

export class ConfigClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ConfigClientOptions = {}) {
    this.baseUrl = (options.baseUrl || "").replace(/\/$/, "");
    this.headers = options.headers || {};
    this.fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis);
  }

  /**
   * `GET /config` — effective values (secrets masked), schema and version.
   *
   * Throws {@link ConfigContractError} when the component answers without a
   * `config` document, rather than reporting an empty config the panel would
   * render — and then save — as schema defaults.
   */
  async getConfig(): Promise<ConfigResponse> {
    const payload = await this.request<ConfigResponse>("GET", "/config");
    assertConfigDocument(payload, "GET /config");
    return payload;
  }

  /**
   * `PUT /config` — partial update.  Throws {@link ConfigValidationError} on
   * 422, {@link ConfigContractError} when the write succeeded but the response
   * carries no `config` document.
   */
  async putConfig(updates: ConfigValues): Promise<ConfigWriteResponse> {
    const payload = await this.request<ConfigWriteResponse>("PUT", "/config", updates);
    assertConfigDocument(payload, "PUT /config");
    return payload;
  }

  /** `GET /config/versions` — recent versions, newest first. */
  async getVersions(): Promise<ConfigVersionsResponse> {
    const payload = await this.request<ConfigVersionsResponse>("GET", "/config/versions");
    if (!Array.isArray(payload?.versions)) {
      throw new ConfigContractError("GET /config/versions", 'no "versions" array in the response');
    }
    return payload;
  }

  /** `POST /config/rollback` — revert to *version*, itself a versioned write. */
  async rollback(version: number): Promise<ConfigWriteResponse> {
    const payload = await this.request<ConfigWriteResponse>("POST", "/config/rollback", {
      version,
    });
    assertConfigDocument(payload, "POST /config/rollback");
    return payload;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json", ...this.headers };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 422 && payload && typeof payload === "object") {
        throw new ConfigValidationError(payload as ConfigProblem);
      }
      const problem = (payload || {}) as ConfigProblem;
      throw new Error(problem.detail || problem.title || `HTTP ${response.status}`);
    }
    return payload as T;
  }
}
