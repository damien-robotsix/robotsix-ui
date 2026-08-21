import "./styles/index.css";

// The framework-free core — usable on its own via `@robotsix/ui/vanilla`.
export * from "./config/index.js";

// The React wrapper, which mounts that same core.
export { ConfigPanel } from "./components/ConfigPanel/index.js";
export type { ConfigPanelProps } from "./components/ConfigPanel/index.js";

// The shared app shell, mirroring the same core + React-wrapper split.
export * from "./appshell/index.js";
export { AppShell } from "./components/AppShell/index.js";
export type { AppShellProps } from "./components/AppShell/index.js";
