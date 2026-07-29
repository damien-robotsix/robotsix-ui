import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormField } from "./FormField.js";
import type { ConfigField } from "../../types.js";

const stringField: ConfigField = {
  key: "name",
  label: "Name",
  type: "string",
  description: "Your full name",
};

const numberField: ConfigField = {
  key: "age",
  label: "Age",
  type: "number",
  min: 0,
  max: 150,
};

const booleanField: ConfigField = {
  key: "active",
  label: "Active",
  type: "boolean",
};

const selectField: ConfigField = {
  key: "color",
  label: "Color",
  type: "select",
  options: [
    { value: "red", label: "Red" },
    { value: "blue", label: "Blue" },
  ],
};

describe("FormField", () => {
  it("renders a text input for string fields", () => {
    render(<FormField field={stringField} value="Alice" onChange={vi.fn()} />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveValue("Alice");
    expect(input).toHaveAttribute("type", "text");
  });

  it("renders a number input for number fields", () => {
    render(<FormField field={numberField} value={42} onChange={vi.fn()} />);
    const input = screen.getByLabelText("Age");
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveValue(42);
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "150");
  });

  it("renders a checkbox for boolean fields", () => {
    render(<FormField field={booleanField} value={true} onChange={vi.fn()} />);
    const input = screen.getByLabelText("Active");
    expect(input).toHaveAttribute("type", "checkbox");
    expect(input).toBeChecked();
  });

  it("renders a select for select fields", () => {
    render(<FormField field={selectField} value="blue" onChange={vi.fn()} />);
    const select = screen.getByLabelText("Color");
    expect(select).toHaveValue("blue");
    expect(screen.getByText("Red")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(<FormField field={stringField} value="" onChange={vi.fn()} />);
    expect(screen.getByText("Your full name")).toBeInTheDocument();
  });

  it("calls onChange on text input", () => {
    const onChange = vi.fn();
    render(<FormField field={stringField} value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bob" } });
    expect(onChange).toHaveBeenCalled();
  });
});
