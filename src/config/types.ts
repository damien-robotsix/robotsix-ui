/**
 * Types for the schema-driven config panel.
 *
 * The panel is driven by the JSON Schema a component commits as
 * `config/config.schema.json` (robotsix-standards `config-standard.md`) and
 * talks to the standard config HTTP surface defined in
 * `config-ownership.md`.  Nothing here is component-specific.
 */

/** A JSON Schema node, restricted to the keywords the panel understands. */
export interface JsonSchemaNode {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  format?: string;
  writeOnly?: boolean;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode | JsonSchemaNode[];
  /**
   * The value schema of an open-ended map — pydantic's `dict[str, X]`, which
   * has no `properties` because its keys are data.  The canonical credential
   * blocks (`langfuse.projects`, `openrouter.keys`) are exactly this shape.
   */
  additionalProperties?: JsonSchemaNode | boolean;
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  $ref?: string;
  $defs?: Record<string, JsonSchemaNode>;
  /**
   * Presentational only — hides the field behind the panel's "Show advanced
   * settings" toggle.  Defined by config-standard.md § 4.
   */
  advanced?: boolean;
  /**
   * Which plane owns the field.  Defaults to `"component"`.  A panel renders
   * the fields its own plane owns and greys out the rest, so the deploy UI and
   * the component's Settings panel never both edit the same key
   * (config-ownership.md).
   */
  "x-deploy-plane"?: DeployPlane;
}

/** Root schema — a JSON Schema object node. */
export type ConfigSchema = JsonSchemaNode;

/** Which plane owns a field, and which plane a panel is rendering for. */
export type DeployPlane = "component" | "deploy";

/** A config document: arbitrarily nested JSON matching the schema. */
export type ConfigValues = Record<string, unknown>;

/** Options shared by the renderer and the value collector. */
export interface ConfigFormOptions {
  /**
   * The plane this panel renders for.  Fields owned by the *other* plane are
   * rendered read-only and are never collected.  Defaults to `"component"`.
   */
  plane?: DeployPlane;
}

/** Options accepted by {@link renderConfigForm}. */
export interface RenderConfigFormOptions extends ConfigFormOptions {
  /**
   * Called whenever a field is edited.  Use it to enable a Save button.
   */
  onChange?: () => void;
}

/** A single entry from `GET /config/versions`. */
export interface ConfigVersion {
  version: number;
  timestamp: string;
  changed_keys: string[];
}

/** The `GET /config` response body. */
export interface ConfigResponse {
  config: ConfigValues;
  schema: ConfigSchema;
  version: number;
}

/** The `PUT /config` / `POST /config/rollback` response body. */
export interface ConfigWriteResponse {
  config: ConfigValues;
  version: number;
}

/** The `GET /config/versions` response body. */
export interface ConfigVersionsResponse {
  versions: ConfigVersion[];
}

/**
 * A validation failure returned by `PUT /config` as `application/problem+json`
 * (http-error-envelope.md).
 */
export interface ConfigProblem {
  type?: string;
  title?: string;
  detail?: string;
  instance?: string;
}

/** Thrown by {@link ConfigClient} when the surface rejects a write. */
export class ConfigValidationError extends Error {
  readonly problem: ConfigProblem;
  /** The dotted key the message blames, when the detail names one. */
  readonly key: string | null;

  constructor(problem: ConfigProblem) {
    const detail = problem.detail || problem.title || "Config validation failed";
    super(detail);
    this.name = "ConfigValidationError";
    this.problem = problem;
    this.key = parseProblemKey(detail);
  }
}

/**
 * Extract the field a `422` detail blames.
 *
 * The standard's example detail is `"retry_interval_s: value must be >= 1"`,
 * so a leading dotted key followed by `": "` identifies the offending field.
 * Returns `null` when the detail is not field-scoped.
 */
export function parseProblemKey(detail: string): string | null {
  const match = /^([A-Za-z_][\w.]*)\s*:\s*\S/.exec(detail);
  return match ? match[1] : null;
}
