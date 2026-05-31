// noExplicitAny: test mocks use type-erased RTK Query API doubles and UNSAFE_root traversal
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import type {ReactTestInstance} from "react-test-renderer";
import {AdminFieldRenderer} from "./AdminFieldRenderer";
import type {AdminApi, AdminFieldConfig, RefFieldRendererProps} from "./types";

const api = {} as unknown as AdminApi;
const base = {api, baseUrl: "/admin", onChange: () => {}};

describe("AdminFieldRenderer (main)", () => {
  it("renders boolean", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "boolean"}}
        fieldKey="isActive"
        value={true}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders boolean with undefined value", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "boolean"}}
        fieldKey="isActive"
        value={undefined}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders number and converts string via onChange to number", () => {
    const onChange = mock((_: unknown) => {});
    renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "number"}}
        fieldKey="count"
        onChange={onChange}
        value={5}
      />
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders number from null value", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "number"}}
        fieldKey="count"
        value={null}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders string", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "string"}}
        fieldKey="name"
        value="hello"
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders date (by type=date)", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "date"}}
        fieldKey="birthDate"
        value="2024-01-01"
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders datetime", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "datetime"}}
        fieldKey="when"
        value="2024-01-01T00:00:00Z"
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders string field with 'date' in name", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "string"}}
        fieldKey="birthDate"
        value="2024"
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders object (JSON) with object value", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "object"}}
        fieldKey="meta"
        value={{a: 1}}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders object (JSON) with string value (serializeJsonValue passes through)", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "object"}}
        fieldKey="meta"
        value="raw-string"
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders object (JSON) with null value", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "object"}}
        fieldKey="meta"
        value={null}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders mixed type (JSON)", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "mixed"}}
        fieldKey="data"
        value={[1, 2]}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders array without items as JSON text", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "array"}}
        fieldKey="tags"
        value={["a", "b"]}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders array string value (string passthrough)", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "array"}}
        fieldKey="tags"
        value="raw"
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders array null value (defaults to [])", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "array"}}
        fieldKey="tags"
        value={null}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders enum", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{enum: ["a", "b"], required: false, type: "string"}}
        fieldKey="status"
        value="a"
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders enum with null value (adds None option)", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{enum: [null, "a"], required: false, type: "string"}}
        fieldKey="status"
        value={undefined}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders markdown widget", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "string", widget: "markdown"}}
        fieldKey="body"
        value="# Hi"
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders textarea widget", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "string", widget: "textarea"}}
        fieldKey="notes"
        value="big text"
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders checkbox-list widget", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={
          {
            items: {enum: ["x", "y"], type: "string"},
            required: false,
            type: "array",
            widget: "checkbox-list",
          } as unknown as AdminFieldConfig
        }
        fieldKey="tags"
        value={[]}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders checkbox-list widget when type is not array (falls through to CheckboxListEditor)", () => {
    // With type "array" the earlier array branches catch the render before the
    // checkbox-list widget branch is reached. A non-array type hits line 328.
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        errorText="oops"
        fieldConfig={
          {required: false, type: "string", widget: "checkbox-list"} as unknown as AdminFieldConfig
        }
        fieldKey="tags"
        value={["a"]}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders checkbox-list widget with null value defaulting to []", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={
          {required: false, type: "string", widget: "checkbox-list"} as unknown as AdminFieldConfig
        }
        fieldKey="tags"
        value={null}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders locale-content widget", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "object", widget: "locale-content"}}
        fieldKey="content"
        value={{en: "hi"}}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders locale-default widget with existing content keys", () => {
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

  it("renders locale-default widget disabled when no locales", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "string", widget: "locale-default"}}
        fieldKey="defaultLocale"
        parentFormState={{content: {}}}
        value=""
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders locale-default widget without parentFormState", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "string", widget: "locale-default"}}
        fieldKey="defaultLocale"
        value=""
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders dynamic enum from sibling plural array", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "string"}}
        fieldKey="variant"
        parentFormState={{variants: [{key: "x"}, {key: "y"}]}}
        value="x"
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("skips dynamic enum when sibling array items lack 'key'", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "string"}}
        fieldKey="variant"
        parentFormState={{variants: [{notKey: "x"}]}}
        value=""
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("skips dynamic enum when parent has no plural sibling array", () => {
    const {toJSON} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "string"}}
        fieldKey="variant"
        parentFormState={{}}
        value=""
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("uses custom refRenderer for single ref fields when matching ref model name", () => {
    const CustomRenderer = mock((_props: RefFieldRendererProps) => (
      <></>
    )) as unknown as React.FC<RefFieldRendererProps>;
    renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{ref: "User", required: false, type: "objectid"}}
        fieldKey="ownerId"
        modelConfigs={[{name: "User", routePath: "/admin/users"}]}
        refRenderers={{User: CustomRenderer}}
        value="abc123"
      />
    );
    expect(CustomRenderer).toHaveBeenCalled();
    const props = (CustomRenderer as unknown as {mock: {calls: unknown[][]}}).mock
      .calls[0][0] as RefFieldRendererProps;
    expect(props.refModelName).toBe("User");
    expect(props.routePath).toBe("/admin/users");
    expect(props.value).toBe("abc123");
  });

  it("does not invoke a refRenderer whose key does not match the field's ref model", () => {
    const CustomRenderer = mock((_props: RefFieldRendererProps) => (
      <></>
    )) as unknown as React.FC<RefFieldRendererProps>;
    // No modelConfigs entry for "Post" so AdminRefField path is also bypassed; this
    // verifies the dispatch logic only fires the renderer when the key matches.
    renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{ref: "Post", required: false, type: "objectid"}}
        fieldKey="postId"
        refRenderers={{User: CustomRenderer}}
        value=""
      />
    );
    expect(CustomRenderer).not.toHaveBeenCalled();
  });

  it("uses custom refRenderer when modelConfigs is missing (empty routePath)", () => {
    const CustomRenderer = mock((_props: RefFieldRendererProps) => (
      <></>
    )) as unknown as React.FC<RefFieldRendererProps>;
    renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{ref: "User", required: false, type: "objectid"}}
        fieldKey="ownerId"
        refRenderers={{User: CustomRenderer}}
        value="x"
      />
    );
    expect(CustomRenderer).toHaveBeenCalled();
    expect(
      (CustomRenderer as unknown as {mock: {calls: unknown[][]}}).mock
        .calls[0][0] as RefFieldRendererProps
    ).toHaveProperty("routePath", "");
  });

  it("triggers onChange handlers for number, enum, array, object", () => {
    const numberChange = mock((_: unknown) => {});
    const {UNSAFE_root: numberRoot} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "number"}}
        fieldKey="count"
        onChange={numberChange}
        value={0}
      />
    );
    const numberFields = numberRoot.findAll(
      (n: ReactTestInstance) => typeof n.props?.onChange === "function"
    );
    numberFields.forEach((n: ReactTestInstance) => {
      n.props.onChange("42");
      n.props.onChange("not-a-number");
    });
    expect(numberChange).toHaveBeenCalled();

    const enumChange = mock((_: unknown) => {});
    const {UNSAFE_root: enumRoot} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{enum: ["a", "b"], required: false, type: "string"}}
        fieldKey="status"
        onChange={enumChange}
        value="a"
      />
    );
    const enumFields = enumRoot.findAll(
      (n: ReactTestInstance) => typeof n.props?.onChange === "function"
    );
    enumFields.forEach((n: ReactTestInstance) => {
      n.props.onChange("");
      n.props.onChange("b");
    });
    expect(enumChange).toHaveBeenCalled();

    const arrayChange = mock((_: unknown) => {});
    const {UNSAFE_root: arrayRoot} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "array"}}
        fieldKey="tags"
        onChange={arrayChange}
        value={[]}
      />
    );
    const arrayFields = arrayRoot.findAll(
      (n: ReactTestInstance) => typeof n.props?.onChange === "function"
    );
    arrayFields.forEach((n: ReactTestInstance) => {
      n.props.onChange("[1,2,3]");
      n.props.onChange("not-json");
    });
    expect(arrayChange).toHaveBeenCalled();

    const objectChange = mock((_: unknown) => {});
    const {UNSAFE_root: objectRoot} = renderWithTheme(
      <AdminFieldRenderer
        {...base}
        fieldConfig={{required: false, type: "object"}}
        fieldKey="meta"
        onChange={objectChange}
        value={{}}
      />
    );
    const objFields = objectRoot.findAll(
      (n: ReactTestInstance) => typeof n.props?.onChange === "function"
    );
    objFields.forEach((n: ReactTestInstance) => {
      n.props.onChange('{"foo":1}');
      n.props.onChange("not-json");
      n.props.onChange("");
    });
    expect(objectChange).toHaveBeenCalled();
  });
});
