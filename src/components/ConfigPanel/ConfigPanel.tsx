import { useEffect, useRef } from "react";
import { mountConfigPanel } from "../../config/panel.js";
import type { ConfigPanelHandle, ConfigPanelOptions } from "../../config/panel.js";

export interface ConfigPanelProps extends ConfigPanelOptions {
  /** Extra class names for the wrapper element. */
  className?: string;
}

/**
 * React wrapper around the framework-free config panel.
 *
 * It mounts the same `mountConfigPanel` implementation that vanilla hosts use,
 * so a React UI and a server-rendered one cannot present a component's
 * settings differently — the "cross-UI uniformity" invariant of
 * robotsix-standards `config-ownership.md`.
 */
export function ConfigPanel({ className, ...options }: ConfigPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ConfigPanelHandle | null>(null);
  // Keep the latest options reachable without re-mounting on every render.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    handleRef.current = mountConfigPanel(host, optionsRef.current);
    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  return <div ref={hostRef} className={className} />;
}
