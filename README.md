# robotsix-ui

Shared UI component library for RobotSix deployed UIs.

## Installation

`@robotsix/ui` is distributed as a **git-based package** — there is no
public npm registry publish.  Pin a git tag or commit SHA in your
`package.json`:

```json
"dependencies": {
  "@robotsix/ui": "git+https://github.com/damien-robotsix/robotsix-ui.git#v0.1.0"
}
```

The `prepare` script builds the library automatically when you run
`npm install`, so no pre-built artifacts are committed to the
repository.

## Usage

### ConfigPanel

The `ConfigPanel` component renders a schema-driven configuration form.  
Define a schema describing your configurable fields, pass the current
values, and receive updates via the `onChange` callback.

```tsx
import React, { useState } from "react";
import { ConfigPanel, type ConfigSchema, type ConfigValues } from "@robotsix/ui";

const schema: ConfigSchema = [
  { key: "title", label: "Title", type: "string", description: "Dashboard title" },
  {
    key: "refreshInterval",
    label: "Refresh (s)",
    type: "number",
    defaultValue: 30,
    min: 5,
    max: 300,
  },
  { key: "autoRefresh", label: "Auto-refresh", type: "boolean", defaultValue: true },
  {
    key: "theme",
    label: "Theme",
    type: "select",
    defaultValue: "light",
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ],
  },
];

function App() {
  const [config, setConfig] = useState<ConfigValues>({});

  return <ConfigPanel schema={schema} config={config} onChange={(updated) => setConfig(updated)} />;
}
```

### Field Types

| Type      | Renders as                       |
| --------- | -------------------------------- |
| `string`  | `<input type="text">`            |
| `number`  | `<input type="number">`          |
| `boolean` | `<input type="checkbox">`        |
| `select`  | `<select>` with provided options |

## Development

```bash
npm install
npm test          # run tests
npm run typecheck # type-check
npm run lint      # lint
npm run build     # build the library
```

## License

MIT — see [LICENSE](./LICENSE).
