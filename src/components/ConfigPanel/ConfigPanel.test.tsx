import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfigPanel } from "./ConfigPanel.js";
import type { ConfigSchema, ConfigValues } from "../../types.js";

const sampleSchema: ConfigSchema = [
  { key: "title", label: "Title", type: "string", description: "Panel title" },
  {
    key: "refreshInterval",
    label: "Refresh (s)",
    type: "number",
    defaultValue: 30,
    min: 1,
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

const initialConfig: ConfigValues = {
  title: "My Dashboard",
  refreshInterval: 60,
  autoRefresh: false,
  theme: "dark",
};

describe("ConfigPanel", () => {
  it("renders all fields from the schema", () => {
    render(<ConfigPanel schema={sampleSchema} config={initialConfig} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Refresh (s)")).toBeInTheDocument();
    expect(screen.getByLabelText("Auto-refresh")).toBeInTheDocument();
    expect(screen.getByLabelText("Theme")).toBeInTheDocument();
  });

  it("renders field descriptions", () => {
    render(<ConfigPanel schema={sampleSchema} config={initialConfig} onChange={vi.fn()} />);

    expect(screen.getByText("Panel title")).toBeInTheDocument();
  });

  it("populates initial config values", () => {
    render(<ConfigPanel schema={sampleSchema} config={initialConfig} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Title")).toHaveValue("My Dashboard");
    expect(screen.getByLabelText("Refresh (s)")).toHaveValue(60);
    expect(screen.getByLabelText("Auto-refresh")).not.toBeChecked();
    expect(screen.getByLabelText("Theme")).toHaveValue("dark");
  });

  it("uses defaultValue when config key is missing", () => {
    render(<ConfigPanel schema={sampleSchema} config={{}} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Refresh (s)")).toHaveValue(30);
    expect(screen.getByLabelText("Auto-refresh")).toBeChecked();
    expect(screen.getByLabelText("Theme")).toHaveValue("light");
  });

  it("calls onChange when a field is edited", () => {
    const onChange = vi.fn();

    // Start with an empty title so we can set the value without clearing.
    const config = { ...initialConfig, title: "" };
    render(<ConfigPanel schema={sampleSchema} config={config} onChange={onChange} />);

    const titleInput = screen.getByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "New Title" } });

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls.at(-1)![0] as ConfigValues;
    expect(lastCall.title).toBe("New Title");
    // Other values preserved
    expect(lastCall.refreshInterval).toBe(60);
  });

  it("handles boolean toggle", () => {
    const onChange = vi.fn();

    render(<ConfigPanel schema={sampleSchema} config={initialConfig} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Auto-refresh"));

    const lastCall = onChange.mock.calls.at(-1)![0] as ConfigValues;
    expect(lastCall.autoRefresh).toBe(true);
  });

  it("handles select change", () => {
    const onChange = vi.fn();

    render(<ConfigPanel schema={sampleSchema} config={initialConfig} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "light" } });

    const lastCall = onChange.mock.calls.at(-1)![0] as ConfigValues;
    expect(lastCall.theme).toBe("light");
  });

  it("renders without crashing with empty schema", () => {
    render(<ConfigPanel schema={[]} config={{}} onChange={vi.fn()} />);
    expect(screen.getByText("", { selector: ".rsu-config-panel" })).toBeInTheDocument();
  });
});
