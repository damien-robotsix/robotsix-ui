import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { mountAppShell } from "../../appshell/appshell.js";
import type { AppShellHandle, AppShellOptions } from "../../appshell/types.js";

export interface AppShellProps extends Omit<AppShellOptions, "rightSlot"> {
  /** Per-app controls rendered into the shell's right slot. */
  rightSlot?: ReactNode;
  /** Extra class names for the wrapper element. */
  className?: string;
}

/**
 * React wrapper around the framework-free app shell.
 *
 * It mounts the same `mountAppShell` implementation that vanilla hosts use,
 * so a React UI and a server-rendered one cannot present the shared chrome
 * differently.  The optional `rightSlot` React node is portalled into the
 * mounted shell's right slot.
 */
export function AppShell({ className, rightSlot, ...options }: AppShellProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<AppShellHandle | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // Keep the latest options reachable without re-mounting on every render.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    handleRef.current = mountAppShell(host, optionsRef.current);
    setSlot(handleRef.current.rightSlot);
    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
      setSlot(null);
    };
  }, []);

  return (
    <>
      <div ref={hostRef} className={className} />
      {slot !== null && rightSlot != null ? createPortal(rightSlot, slot) : null}
    </>
  );
}
