/**
 * The schema-driven config panel — the fleet's single settings renderer.
 *
 * `mountConfigPanel` is the entry point a component's Settings screen uses.
 * The lower-level pieces (`renderConfigForm`, `collectConfigValues`,
 * `ConfigClient`) are exported for hosts that need to embed the form inside a
 * larger screen or drive the surface themselves.
 */

export { ConfigClient, type ConfigClientOptions } from "./client.js";
export { collectConfigValues, diffConfigValues } from "./collect.js";
export {
  ADVANCED_CLASS,
  FOREIGN_CLASS,
  COLLAPSIBLE_SECTION_CLASS,
  SECTION_COLLAPSED_CLASS,
  clearFieldErrors,
  hasAdvancedFields,
  renderConfigForm,
  setAdvancedVisible,
  showFieldError,
} from "./render.js";
export { mountConfigPanel, type ConfigPanelHandle, type ConfigPanelOptions } from "./panel.js";
export {
  arrayItemObject,
  ensureJsonSchema,
  fieldPlane,
  isObjectNode,
  isSecretField,
  mapValueSchema,
  resolveRef,
  setNestedValue,
} from "./schema.js";
export { escAttr, escHtml, renderInlineMarkdown } from "./html.js";
export {
  ConfigContractError,
  ConfigValidationError,
  parseProblemKey,
  type ConfigFormOptions,
  type ConfigProblem,
  type ConfigResponse,
  type ConfigSchema,
  type ConfigValues,
  type ConfigVersion,
  type ConfigVersionsResponse,
  type ConfigWriteResponse,
  type DeployPlane,
  type JsonSchemaNode,
  type RenderConfigFormOptions,
} from "./types.js";
