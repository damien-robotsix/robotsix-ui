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
import { ConfigValidationError } from "./types.js";

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

  /** `GET /config` — effective values (secrets masked), schema and version. */
  async getConfig(): Promise<ConfigResponse> {
    return this.request<ConfigResponse>("GET", "/config");
  }

  /** `PUT /config` — partial update.  Throws {@link ConfigValidationError} on 422. */
  async putConfig(updates: ConfigValues): Promise<ConfigWriteResponse> {
    return this.request<ConfigWriteResponse>("PUT", "/config", updates);
  }

  /** `GET /config/versions` — recent versions, newest first. */
  async getVersions(): Promise<ConfigVersionsResponse> {
    return this.request<ConfigVersionsResponse>("GET", "/config/versions");
  }

  /** `POST /config/rollback` — revert to *version*, itself a versioned write. */
  async rollback(version: number): Promise<ConfigWriteResponse> {
    return this.request<ConfigWriteResponse>("POST", "/config/rollback", { version });
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
