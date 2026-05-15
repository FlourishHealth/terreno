import {describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {act, fireEvent} from "../../ui/node_modules/@testing-library/react-native";
import {CheckboxListEditor} from "./CheckboxListEditor";

const press = async (el: any): Promise<void> => {
  await act(async () => {
    fireEvent.press(el);
    await new Promise((r) => setTimeout(r, 150));
  });
};

describe("CheckboxListEditor", () => {
  it("renders title, helper, and checkbox items", () => {
    const {toJSON, getByTestId} = renderWithTheme(
      <CheckboxListEditor
        errorText="err"
        helperText="help"
        onChange={() => {}}
        title="Checkboxes"
        value={[
          {confirmationPrompt: "Confirm?", label: "First", required: true},
          {label: "Second", required: false},
        ]}
      />
    );
    expect(toJSON()).toBeDefined();
    expect(getByTestId("checkbox-add-button")).toBeDefined();
    expect(getByTestId("checkbox-remove-0")).toBeDefined();
  });

  it("handles non-array values gracefully", () => {
    const {toJSON} = renderWithTheme(
      <CheckboxListEditor onChange={() => {}} value={undefined as any} />
    );
    expect(toJSON()).toBeDefined();
  });

  it("adds a new item when Add is clicked", async () => {
    const onChange = mock((_: unknown) => undefined);
    const {getByTestId} = renderWithTheme(<CheckboxListEditor onChange={onChange} value={[]} />);
    await press(getByTestId("checkbox-add-button"));
    expect(onChange).toHaveBeenCalled();
    const next = (onChange.mock.calls[0] as any)[0];
    expect(next).toEqual([{label: "", required: false}]);
  });

  it("removes an item when the remove icon is clicked", async () => {
    const onChange = mock((_: unknown) => undefined);
    const {getByTestId} = renderWithTheme(
      <CheckboxListEditor
        onChange={onChange}
        value={[
          {label: "a", required: false},
          {label: "b", required: false},
        ]}
      />
    );
    await press(getByTestId("checkbox-remove-0"));
    expect(onChange).toHaveBeenCalled();
    const next = (onChange.mock.calls[0] as any)[0];
    expect(next).toHaveLength(1);
    expect(next[0].label).toBe("b");
  });

  it("updates a field when label/prompt changes", () => {
    const onChange = mock((_: unknown) => undefined);
    const {getByTestId} = renderWithTheme(
      <CheckboxListEditor onChange={onChange} value={[{label: "a", required: false}]} />
    );
    fireEvent.changeText(getByTestId("checkbox-label-0"), "new-label");
    const first = (onChange.mock.calls[0] as any)[0];
    expect(first[0].label).toBe("new-label");

    fireEvent.changeText(getByTestId("checkbox-prompt-0"), "prompt?");
    const second = (onChange.mock.calls[1] as any)[0];
    expect(second[0].confirmationPrompt).toBe("prompt?");
  });
});
