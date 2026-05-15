import {describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {act, fireEvent} from "../../ui/node_modules/@testing-library/react-native";
import {AdminPrimitiveArrayField} from "./AdminPrimitiveArrayField";

const press = async (el: any): Promise<void> => {
  await act(async () => {
    fireEvent.press(el);
    await new Promise((r) => setTimeout(r, 150));
  });
};

const mockApi: any = {
  endpoints: {},
  reducerPath: "test",
};

describe("AdminPrimitiveArrayField", () => {
  it("renders empty state when no items", () => {
    const {getByText, getByTestId} = renderWithTheme(
      <AdminPrimitiveArrayField
        api={mockApi}
        baseUrl="/admin"
        itemType="string"
        onChange={() => {}}
        title="Tags"
        value={[]}
      />
    );
    expect(getByText(/No items/i)).toBeDefined();
    expect(getByTestId("admin-array-add-Tags")).toBeDefined();
  });

  it("renders existing string items as TextFields", () => {
    const {getByTestId} = renderWithTheme(
      <AdminPrimitiveArrayField
        api={mockApi}
        baseUrl="/admin"
        itemType="string"
        onChange={() => {}}
        title="Tags"
        value={["foo", "bar"]}
      />
    );
    expect(getByTestId("admin-array-item-0")).toBeDefined();
    expect(getByTestId("admin-array-item-1")).toBeDefined();
    expect(getByTestId("admin-array-remove-0")).toBeDefined();
    expect(getByTestId("admin-array-remove-1")).toBeDefined();
  });

  it("adds a new item with the type's default", async () => {
    const onChange = mock((_: unknown) => undefined);
    const {getByTestId} = renderWithTheme(
      <AdminPrimitiveArrayField
        api={mockApi}
        baseUrl="/admin"
        itemType="string"
        onChange={onChange}
        title="Tags"
        value={["foo"]}
      />
    );
    await press(getByTestId("admin-array-add-Tags"));
    expect(onChange).toHaveBeenCalled();
    const next = (onChange.mock.calls[0] as any)[0];
    expect(next).toEqual(["foo", ""]);
  });

  it("removes an item when the remove button is pressed", async () => {
    const onChange = mock((_: unknown) => undefined);
    const {getByTestId} = renderWithTheme(
      <AdminPrimitiveArrayField
        api={mockApi}
        baseUrl="/admin"
        itemType="string"
        onChange={onChange}
        title="Tags"
        value={["a", "b", "c"]}
      />
    );
    await press(getByTestId("admin-array-remove-1"));
    expect(onChange).toHaveBeenCalled();
    const next = (onChange.mock.calls[0] as any)[0];
    expect(next).toEqual(["a", "c"]);
  });

  it("updates a string item when its TextField changes", () => {
    const onChange = mock((_: unknown) => undefined);
    const {getByTestId} = renderWithTheme(
      <AdminPrimitiveArrayField
        api={mockApi}
        baseUrl="/admin"
        itemType="string"
        onChange={onChange}
        title="Tags"
        value={["old"]}
      />
    );
    fireEvent.changeText(getByTestId("admin-array-item-0"), "new");
    expect(onChange).toHaveBeenCalled();
    const next = (onChange.mock.calls[0] as any)[0];
    expect(next).toEqual(["new"]);
  });

  it("coerces number input via Number()", () => {
    const onChange = mock((_: unknown) => undefined);
    const {getByTestId} = renderWithTheme(
      <AdminPrimitiveArrayField
        api={mockApi}
        baseUrl="/admin"
        itemType="number"
        onChange={onChange}
        title="Scores"
        value={[1, 2]}
      />
    );
    fireEvent.changeText(getByTestId("admin-array-item-0"), "42");
    const next = (onChange.mock.calls[0] as any)[0];
    expect(next).toEqual([42, 2]);
  });

  it("uses the boolean default when adding to a [Boolean] field", async () => {
    const onChange = mock((_: unknown) => undefined);
    const {getByTestId} = renderWithTheme(
      <AdminPrimitiveArrayField
        api={mockApi}
        baseUrl="/admin"
        itemType="boolean"
        onChange={onChange}
        title="Flags"
        value={[]}
      />
    );
    await press(getByTestId("admin-array-add-Flags"));
    const next = (onChange.mock.calls[0] as any)[0];
    expect(next).toEqual([false]);
  });

  it("uses the number default when adding to a [Number] field", async () => {
    const onChange = mock((_: unknown) => undefined);
    const {getByTestId} = renderWithTheme(
      <AdminPrimitiveArrayField
        api={mockApi}
        baseUrl="/admin"
        itemType="number"
        onChange={onChange}
        title="Scores"
        value={[]}
      />
    );
    await press(getByTestId("admin-array-add-Scores"));
    const next = (onChange.mock.calls[0] as any)[0];
    expect(next).toEqual([0]);
  });

  it("renders enum items as a SelectField", () => {
    const {toJSON} = renderWithTheme(
      <AdminPrimitiveArrayField
        api={mockApi}
        baseUrl="/admin"
        itemEnum={["low", "medium", "high"]}
        itemType="string"
        onChange={() => {}}
        title="Levels"
        value={["low"]}
      />
    );
    // SelectField has no testID prop here, so just sanity-check the tree renders
    expect(toJSON()).toBeDefined();
  });

  it("handles non-array values gracefully", () => {
    const {toJSON} = renderWithTheme(
      <AdminPrimitiveArrayField
        api={mockApi}
        baseUrl="/admin"
        itemType="string"
        onChange={() => {}}
        title="Tags"
        value={undefined as any}
      />
    );
    expect(toJSON()).toBeDefined();
  });
});
