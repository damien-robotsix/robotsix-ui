/**
 * Framework-free entry point — `@robotsix/ui/vanilla`.
 *
 * Every RobotSix UI today is server-rendered HTML with plain `<script>` tags
 * and no bundler, so this build imports no React and can be loaded directly:
 *
 * ```html
 * <link rel="stylesheet" href="/static/robotsix-ui.css">
 * <script type="module">
 *   import { mountConfigPanel } from "/static/robotsix-ui-vanilla.js";
 *   mountConfigPanel(document.getElementById("settings"));
 * </script>
 * ```
 *
 * The React `ConfigPanel` in the main entry wraps these same functions, so the
 * two can never render a component's settings differently.
 */

export * from "./config/index.js";
