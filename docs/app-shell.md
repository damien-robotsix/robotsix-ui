# The shared app shell

`@robotsix/ui` owns the fleet's **single top-level navigation chrome** — the
header every deployed RobotSix UI renders. A component does not hand-roll its
own header, brand, or nav links; it describes them declaratively and mounts
this shell, so every UI presents the same brand, the same nav behaviour, and
the same Settings entry, exactly as `ConfigPanel` unifies the settings
surface.

## What you describe

The shell is a pure function of your options — no framework-specific code and
no per-component HTML:

| Option         | Meaning                                                          |
| -------------- | ---------------------------------------------------------------- |
| `brand`        | Product name shown on the left (e.g. `"File Hub"`).              |
| `navItems`     | Ordered list of `{ label, href, active?, icon? }` primary links. |
| `settingsHref` | Target of the standard Settings entry. Omit to hide the link.    |
| `rightSlot`    | Per-app controls on the far right (health badge, account, etc.). |

`navItems` render in order; an item with `active: true` is highlighted and
carries `aria-current="page"`. `icon` is decorative text (an emoji or short
symbol) rendered before the label.

## Mounting it — server-rendered UI (no bundler)

Fleet UIs are server-rendered pages with plain `<script>` tags, so use the
React-free build:

```html
<link rel="stylesheet" href="/static/robotsix-ui.css" />
<header id="app-shell"></header>
<script type="module">
  import { mountAppShell } from "/static/robotsix-ui-vanilla.js";

  mountAppShell(document.getElementById("app-shell"), {
    brand: "File Hub",
    navItems: [
      { label: "Files", href: "/files", active: true },
      { label: "Jobs", href: "/jobs" },
    ],
    settingsHref: "/settings",
  });
</script>
```

That is the whole integration. The shell renders the same `rsu-appshell-*`
markup and styles every other UI renders.

## Mounting it — React

```tsx
import { AppShell } from "@robotsix/ui";
import "@robotsix/ui/style.css";

<AppShell
  brand="File Hub"
  navItems={[
    { label: "Files", href: "/files", active: true },
    { label: "Jobs", href: "/jobs" },
  ]}
  settingsHref="/settings"
/>;
```

The React component is a thin wrapper that mounts the same core, so it cannot
drift from the vanilla one. Its `rightSlot` prop accepts a React node and
portals it into the mounted shell.

## Per-app right slot

The right slot holds controls that are specific to one app but should still
live in the standard chrome. Vanilla hosts pass an element (or plain text):

```js
const badge = document.createElement("span");
badge.className = "rsu-badge rsu-badge--success";
badge.textContent = "Healthy";

mountAppShell(document.getElementById("app-shell"), { rightSlot: badge });
```

React hosts pass JSX directly:

```tsx
<AppShell
  brand="File Hub"
  rightSlot={<span className="rsu-badge rsu-badge--success">Healthy</span>}
/>
```

## Responsive behaviour

On viewports narrower than `640px` the nav links collapse behind a hamburger
button (`rsu-appshell-toggle`). Tapping it toggles the `rsu-appshell--open`
state on the shell root, which reveals the links as a full-width dropdown.

## Styling

All shell styles are driven by the existing `--rsu-*` design tokens and ship
in the same self-contained `dist/style.css` under `rsu-appshell-*` classes.
Override the tokens in your repo to theme the shell the same way you theme the
rest of the library — there are no shell-specific colours or hard-coded
values.
