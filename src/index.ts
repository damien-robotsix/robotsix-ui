import "./styles/index.css";

// The framework-free core — usable on its own via `@robotsix/ui/vanilla`.
export * from "./config-panel/index.js";

// The React wrapper, which mounts that same core.
export { ConfigPanel } from "./config-panel-react/index.js";
export type { ConfigPanelProps } from "./config-panel-react/index.js";

// The shared app shell, mirroring the same core + React-wrapper split.
export * from "./appshell/index.js";
export { AppShell } from "./components/AppShell/index.js";
export type { AppShellProps } from "./components/AppShell/index.js";
