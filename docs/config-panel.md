# The shared config panel

`@robotsix/ui` owns the fleet's **only** settings renderer. A component does
not write its own — it mounts this one, so every UI presents the identical
fields with identical typed inputs, identical secret handling and identical
validation, as required by robotsix-standards
[`config-ownership.md`](https://github.com/damien-robotsix/robotsix-standards/blob/main/docs/config-ownership.md)
("cross-UI uniformity").

## What you need before mounting it

1. A committed `config/config.schema.json` — the JSON Schema emitted from your
   pydantic model by `robotsix_config.config_schema_json`.
2. The standard config HTTP surface on your service port:
   `GET /config`, `PUT /config`, `GET /config/versions`, `POST /config/rollback`.

The panel needs nothing else. It never contains component-specific code.

### The response envelopes are not optional

`GET /config`, `PUT /config` and `POST /config/rollback` must return the config
document **under a `config` key** (`{"config": …, "schema": …, "version": …}`),
and `GET /config/versions` must return `{"versions": […]}`. A component that
spreads its config across the top level instead hands the panel an empty
document: every field then renders at its schema default, and the operator's
next Save writes those defaults over the live config — exactly how robotsix-chat
lost its settings on 2026-08-24.

The client refuses such a response with a `ConfigContractError` rather than
rendering it, so the failure surfaces as a load error in the panel instead of a
silent config wipe. If you see one, fix the component's response shape.

## Mounting it — server-rendered UI (no bundler)

Every fleet UI today is a server-rendered page with plain `<script>` tags, so
use the React-free build:

```html
<link rel="stylesheet" href="/static/robotsix-ui.css" />
<div id="settings"></div>
<script type="module">
  import { mountConfigPanel } from "/static/robotsix-ui-vanilla.js";

  mountConfigPanel(document.getElementById("settings"), {
    title: "Settings",
  });
</script>
```

That is the whole integration. The panel fetches `GET /config`, renders the
schema, and wires save, the advanced toggle, and the history tab.

Copy the two files in during your build or image step. The package's `prepare`
script builds `dist/` on install, so no build toolchain is needed on your side
beyond `npm install`:

```bash
npm install "github:damien-robotsix/robotsix-ui#v0.1.6"
cp node_modules/@robotsix/ui/dist/vanilla.js static/robotsix-ui-vanilla.js
cp node_modules/@robotsix/ui/dist/style.css  static/robotsix-ui.css
```

A Python component with no Node toolchain can do the same in a builder stage:

```dockerfile
FROM node:22-alpine AS ui
RUN npm install --no-save "github:damien-robotsix/robotsix-ui#v0.1.6"

FROM python:3.14-slim
COPY --from=ui /node_modules/@robotsix/ui/dist/vanilla.js /app/static/robotsix-ui-vanilla.js
COPY --from=ui /node_modules/@robotsix/ui/dist/style.css  /app/static/robotsix-ui.css
```

Pin a tag, never a branch — the pin is what makes "every UI renders the same
thing" verifiable.

## Mounting it — React

```tsx
import { ConfigPanel } from "@robotsix/ui";
import "@robotsix/ui/style.css";

<ConfigPanel baseUrl="/api" title="Settings" />;
```

The React component is a thin wrapper that mounts the same core, so it cannot
drift from the vanilla one.

## Options

| Option    | Meaning                                                              |
| --------- | -------------------------------------------------------------------- |
| `baseUrl` | Prefix for the four config routes. Defaults to same-origin root.     |
| `headers` | Extra request headers (auth token, CSRF).                            |
| `client`  | A pre-built `ConfigClient`, when you need custom transport.          |
| `title`   | Heading above the form. Defaults to `"Settings"`.                    |
| `history` | Set `false` to hide the version-history tab.                         |
| `plane`   | `"component"` (default) or `"deploy"` — see below.                   |
| `initial` | A `GET /config` response, to skip the initial fetch.                 |
| `onSaved` | Called with `{config, version}` after a successful save or rollback. |

## What the schema controls

The panel reads these keywords, all of which your pydantic model already
emits:

| Schema                                                       | Rendered as                                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `"type": "integer"` / `"number"`                             | number input (integers step by 1)                                                   |
| `"type": "boolean"`                                          | checkbox                                                                            |
| `"enum": [...]`                                              | dropdown                                                                            |
| `"type": "object"`                                           | its own titled section, nested to any depth                                         |
| `"type": "object"` with `enabled: boolean` (default `false`) | collapsible feature block, collapsed by default; click title to expand              |
| `"type": "array"` of objects                                 | repeatable section with add/remove                                                  |
| `"type": "array"` of scalars                                 | one JSON-list input                                                                 |
| `"format": "password", "writeOnly": true`                    | masked input + set/unset badge, never echoed                                        |
| `"advanced": true`                                           | hidden behind "Show advanced settings"                                              |
| `"description"`                                              | inline help (`code`, bold, italic, http links); also the primary hover-tooltip text |
| `$ref` / `$defs`, `anyOf: [X, null]`                         | resolved and unwrapped before rendering                                             |

Secrets follow merge-on-write: the field renders blank, and a blank field is
omitted from the update, so the stored secret survives. Only a value the
operator actually types overwrites it.

### Hover tooltips

Hover over any setting name to see its help text. Each field's tooltip shows:

- The schema `description` (if present) with full inline markdown support (`code`, bold, italic, links)
- For top-level fields without a description: no tooltip (redundant with visible context)
- For nested fields without a description: the full dotted key path (for namespace clarity)
- For fields with descriptions: the description plus the dotted key path on a second line

Long descriptions (>140 characters or multi-line) also display a "Show advanced" section in the panel body with expand/collapse toggles, so operators can see full details without tooltip truncation.

### Collapsible feature blocks

An object-typed field that contains a boolean `enabled` property renders as a collapsible **feature block**. When `enabled` defaults to `false`, the block starts collapsed — the operator sees only the title and expand button. Click the title to reveal the block's other fields (the feature's configuration knobs). When `enabled` defaults to `true`, the block starts expanded.

This keeps disabled features (like `sftp`, `public_fetch`, `gateway_route`) out of the operator's way without hiding them completely. Re-opening a disabled block later reveals all its fields unchanged and ready to configure.

## `x-deploy-plane`

A field annotated `{"x-deploy-plane": "deploy"}` is owned by the deploy plane
(image, mounts, ports, resource limits — the allowlist in
`config-ownership.md`). Unannotated fields are component-owned.

One renderer serves both planes: a panel edits the fields _its_ plane owns and
shows the rest greyed out for orientation, and **never collects or writes the
other plane's keys**. That is what stops the deploy UI and a component's own
Settings panel from both writing the same key.

Annotate a pydantic field with:

```python
image: str = Field(json_schema_extra={"x-deploy-plane": "deploy"})
```

## Lower-level pieces

`mountConfigPanel` is the whole panel. When you need to embed the form inside a
larger screen, the parts are exported too:

- `renderConfigForm(container, schema, values, options)` — draw the inputs
- `collectConfigValues(schema, container, options)` — read them back
- `diffConfigValues(loaded, entered)` — reduce to changed keys only
- `ConfigClient` — the four routes, with `422` `problem+json` mapped to a typed
  `ConfigValidationError` carrying the offending `key`
- `setAdvancedVisible` / `hasAdvancedFields` / `showFieldError` /
  `clearFieldErrors` — for a host-owned chrome
