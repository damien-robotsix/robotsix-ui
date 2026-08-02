/**
 * Public types.
 *
 * The canonical definitions live in `./config/types.ts`, next to the code that
 * consumes them; this module re-exports them so `@robotsix/ui` keeps one stable
 * import path for types.
 */

export type {
  ConfigFormOptions,
  ConfigProblem,
  ConfigResponse,
  ConfigSchema,
  ConfigValues,
  ConfigVersion,
  ConfigVersionsResponse,
  ConfigWriteResponse,
  DeployPlane,
  JsonSchemaNode,
  RenderConfigFormOptions,
} from "./config/types.js";
export { ConfigValidationError, parseProblemKey } from "./config/types.js";
