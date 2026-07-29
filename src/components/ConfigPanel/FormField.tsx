import type { ConfigField } from "../../types.js";

interface FieldInputProps {
  field: ConfigField;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  switch (field.type) {
    case "boolean":
      return (
        <input
          type="checkbox"
          id={field.key}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case "number":
      return (
        <input
          type="number"
          id={field.key}
          value={String(value)}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
    case "select":
      return (
        <select id={field.key} value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case "string":
    default:
      return (
        <input
          type="text"
          id={field.key}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

interface FormFieldProps {
  field: ConfigField;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}

export function FormField({ field, value, onChange }: FormFieldProps) {
  return (
    <div className="rsu-field">
      <label htmlFor={field.key} className="rsu-field-label">
        {field.label}
      </label>
      <FieldInput field={field} value={value} onChange={onChange} />
      {field.description && <p className="rsu-field-description">{field.description}</p>}
    </div>
  );
}
