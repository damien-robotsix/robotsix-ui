/**
 * Types for the shared AppShell navigation primitive.
 *
 * The shell is declarative and host-agnostic: a host describes its chrome
 * (brand, ordered nav links, settings entry) and both the React wrapper and
 * the framework-free `mountAppShell` render the identical markup, so every
 * deployed RobotSix UI presents the same top-level navigation.
 */

/** A single link in the shell's primary navigation. */
export interface AppShellNavItem {
  /** The link's visible text. */
  label: string;
  /** The link target. */
  href: string;
  /** Highlight this link as the current page. */
  active?: boolean;
  /** Decorative icon text (an emoji or short symbol) rendered before the label. */
  icon?: string;
}

/** Options accepted by {@link mountAppShell}. */
export interface AppShellOptions {
  /** The product name shown on the left of the shell. */
  brand?: string;
  /** Ordered list of primary navigation links. */
  navItems?: AppShellNavItem[];
  /** Target of the standard Settings entry.  Omit to hide the link. */
  settingsHref?: string;
  /**
   * Per-app controls rendered at the far right (health badge, account, etc.).
   * A string is rendered as plain text; pass an `Element` (or other `Node`)
   * for markup.
   */
  rightSlot?: string | Node;
}

/** Handle returned by {@link mountAppShell}. */
export interface AppShellHandle {
  /** The shell's root element. */
  readonly element: HTMLElement;
  /** The right-slot container, for hosts that manage its content themselves. */
  readonly rightSlot: HTMLElement;
  /** Remove the shell from the DOM. */
  destroy(): void;
}
