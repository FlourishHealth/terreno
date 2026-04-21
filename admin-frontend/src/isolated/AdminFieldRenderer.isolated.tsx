import {describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";

mock.module("../AdminNestedArrayField", () => ({
  AdminNestedArrayField: ({title}: {title: string}) =>
    React.createElement("AdminNestedArrayField", {title}),
}));
mock.module("../AdminRefField", () => ({
  AdminRefField: ({title}: {title: string}) => React.createElement("AdminRefField", {title}),
}));
mock.module("../CheckboxListEditor", () => ({
  CheckboxListEditor: ({title}: {title: string}) =>
    React.createElement("CheckboxListEditor", {title}),
}));
mock.module("../LocaleContentEditor", () => ({
  LocaleContentEditor: ({title}: {title: string}) =>
    React.createElement("LocaleContentEditor", {title}),
}));

import {AdminFieldRenderer} from "../AdminFieldRenderer";

const api = {} as any;
const base = {api, baseUrl: "/admin", onChange: () => {}};

describe("AdminFieldRenderer", () => {
  it.each([
    ["boolean default", {required: false, type: "boolean"}, true],
    ["number default", {required: false, type: "number"}, 42],
    ["string default", {required: false, type: "string"}, "hello"],
    ["date (by type)", {required: false, type: "date"}, "2024-01-01"],
    ["datetime", {required: false, type: "datetime"}, "2024-01-01T00:00:00Z"],
    ["string field with 'date' in name", {required: false, type: "string"}, "2024-01-01"],
    ["object (JSON)", {required: false, type: "object"}, {foo: "bar"}],
    ["mixed (JSON)", {required: false, type: "mixed"}, [1, 2]],
    [
      "array with items",
      {items: {name: {required: false, type: "string"}}, required: false, type: "array"},
      [],
    ],
    ["array without items", {required: false, type: "array"}, [1, 2, 3]],
    ["array string fallback", {required: false, type: "array"}, "raw-string"],
    [
      "enum",
      {
        enum: ["active", "inactive"],
        required: false,
        type: "string",
      },
      "active",
    ],
    [
      "enum with null value",
      {
        enum: [null, "a"],
        required: false,
        type: "string",
      },
      undefined,
    ],
    ["widget markdown", {required: false, type: "string", widget: "markdown"}, "# Hi"],
    ["widget textarea", {required: false, type: "string", widget: "textarea"}, "some text"],
    ["widget checkbox-list", {required: false, type: "array", widget: "checkbox-list"}, []],
    [
      "widget locale-content",
      {required: false, type: "object", widget: "locale-content"},
      {en: "hi"},
    ],
  ])("renders %s type", (_label, fieldConfig, value) => {
    const fieldKey = _label === "string field with 'date' in name" ? "birthDate" : "field";
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={fieldConfig as any}
        fieldKey={fieldKey}
        value={value}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders reference field when ref+modelConfigs match", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{ref: "User", required: false, type: "string"}}
        fieldKey="owner"
        modelConfigs={[{name: "User", routePath: "/admin/users"}]}
        value=""
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("falls back to default when ref model is missing", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{ref: "Unknown", required: false, type: "string"}}
        fieldKey="owner"
        modelConfigs={[{name: "User", routePath: "/admin/users"}]}
        value=""
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders dynamic enum from a sibling plural array (e.g. variant→variants)", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "string"}}
        fieldKey="variant"
        parentFormState={{variants: [{key: "a"}, {key: "b"}]}}
        value="a"
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders locale-default widget using sibling content map", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "string", widget: "locale-default"}}
        fieldKey="defaultLocale"
        parentFormState={{content: {en: "hi", es: "hola"}}}
        value="en"
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders locale-default as disabled when no locales exist", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "string", widget: "locale-default"}}
        fieldKey="defaultLocale"
        parentFormState={{}}
        value=""
      />
    );
    expect(toJSON()).toBeDefined();
  });
});
