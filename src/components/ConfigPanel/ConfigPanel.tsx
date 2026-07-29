import { useCallback } from "react";
import type { ConfigSchema, ConfigValues } from "../../types.js";
import { FormField } from "./FormField.js";

export interface ConfigPanelProps {
  /** The schema describing the configurable fields. */
  schema: ConfigSchema;
  /** Current config values, keyed by field key. */
  config: ConfigValues;
  /** Called with updated config when any field changes. */
  onChange: (updated: ConfigValues) => void;
}

/**
 * ConfigPanel renders a schema-driven configuration form.
 *
 * Each field in the schema maps to a form control (text, number,
 * checkbox, or select).  The host UI mounts this panel and receives
 * updated config via the `onChange` callback.
 */
export function ConfigPanel({ schema, config, onChange }: ConfigPanelProps) {
  const handleFieldChange = useCallback(
    (key: string, value: string | number | boolean) => {
      onChange({ ...config, [key]: value });
    },
    [config, onChange],
  );

  return (
    <div className="rsu-config-panel">
      {schema.map((field) => (
        <FormField
          key={field.key}
          field={field}
          value={config[field.key] ?? field.defaultValue ?? ""}
          onChange={(value) => handleFieldChange(field.key, value)}
        />
      ))}
    </div>
  );
}
