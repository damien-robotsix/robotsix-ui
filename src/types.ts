/** A single field definition in the config schema. */
export interface ConfigField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select";
  defaultValue?: string | number | boolean;
  description?: string;
  /** Options for 'select' fields. */
  options?: { value: string; label: string }[];
  /** Minimum value for 'number' fields. */
  min?: number;
  /** Maximum value for 'number' fields. */
  max?: number;
}

/** A schema is an ordered list of field definitions. */
export type ConfigSchema = ConfigField[];

/** Flat key-value config object. */
export type ConfigValues = Record<string, string | number | boolean>;
