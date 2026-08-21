/**
 * The shared AppShell navigation primitive.
 *
 * `mountAppShell` is the entry point every RobotSix UI uses for its top-level
 * chrome: brand, ordered nav links, the standard Settings entry, and an
 * optional per-app right slot.  Styling comes entirely from the `--rsu-*`
 * design tokens via the `rsu-appshell-*` classes, so the React wrapper and a
 * server-rendered page can never present the shell differently.
 */

import type { AppShellHandle, AppShellNavItem, AppShellOptions } from "./types.js";

const SHELL_HTML = `
<header class="rsu-appshell">
  <span class="rsu-appshell-brand"></span>
  <button
    type="button"
    class="rsu-appshell-toggle"
    aria-expanded="false"
    aria-label="Toggle navigation"
  >
    <span class="rsu-appshell-toggle-bar"></span>
    <span class="rsu-appshell-toggle-bar"></span>
    <span class="rsu-appshell-toggle-bar"></span>
  </button>
  <nav class="rsu-appshell-nav" aria-label="Main navigation">
    <ul class="rsu-appshell-nav-list"></ul>
  </nav>
  <div class="rsu-appshell-right">
    <a class="rsu-appshell-settings" hidden>Settings</a>
    <div class="rsu-appshell-slot"></div>
  </div>
</header>
`;

/**
 * Render the shared navigation shell into *container*.
 *
 * Replaces any previous content.  The returned handle exposes the root
 * element and the right slot so hosts can drive the shell without re-mounting.
 */
export function mountAppShell(
  container: HTMLElement,
  options: AppShellOptions = {},
): AppShellHandle {
  container.innerHTML = SHELL_HTML;
  const root = container.querySelector(".rsu-appshell") as HTMLElement;
  const brandEl = root.querySelector(".rsu-appshell-brand") as HTMLElement;
  const navList = root.querySelector(".rsu-appshell-nav-list") as HTMLElement;
  const toggle = root.querySelector(".rsu-appshell-toggle") as HTMLButtonElement;
  const settingsEl = root.querySelector(".rsu-appshell-settings") as HTMLAnchorElement;
  const rightSlot = root.querySelector(".rsu-appshell-slot") as HTMLElement;

  if (options.brand) {
    brandEl.textContent = options.brand;
  } else {
    brandEl.hidden = true;
  }

  renderNav(navList, options.navItems || []);

  if (options.settingsHref) {
    settingsEl.setAttribute("href", options.settingsHref);
    settingsEl.hidden = false;
  }

  if (options.rightSlot != null) {
    setSlot(rightSlot, options.rightSlot);
  }

  toggle.addEventListener("click", () => {
    const open = root.classList.toggle("rsu-appshell--open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  return {
    element: root,
    rightSlot,
    destroy: () => {
      container.innerHTML = "";
    },
  };
}

function renderNav(list: HTMLElement, items: AppShellNavItem[]): void {
  list.textContent = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.className = "rsu-appshell-nav-item";

    const link = document.createElement("a");
    link.className = "rsu-appshell-link";
    link.setAttribute("href", item.href);
    if (item.active) {
      link.classList.add("rsu-appshell-link--active");
      link.setAttribute("aria-current", "page");
    }

    if (item.icon) {
      const icon = document.createElement("span");
      icon.className = "rsu-appshell-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = item.icon;
      link.appendChild(icon);
    }

    const label = document.createElement("span");
    label.className = "rsu-appshell-label";
    label.textContent = item.label;
    link.appendChild(label);

    li.appendChild(link);
    list.appendChild(li);
  }
}

function setSlot(slot: HTMLElement, content: string | Node): void {
  slot.textContent = "";
  if (typeof content === "string") {
    slot.textContent = content;
  } else {
    slot.appendChild(content);
  }
}
