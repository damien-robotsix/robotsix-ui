# robotsix-ui

Shared UI component library for RobotSix deployed UIs.

## Installation

```bash
npm install @robotsix/ui
```

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
