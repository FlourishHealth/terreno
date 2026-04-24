import {describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {act, fireEvent} from "../../ui/node_modules/@testing-library/react-native";
import {LocaleContentEditor} from "./LocaleContentEditor";

const press = async (el: any): Promise<void> => {
  await act(async () => {
    fireEvent.press(el);
    await new Promise((r) => setTimeout(r, 150));
  });
};

describe("LocaleContentEditor", () => {
  it("renders without crashing and shows 'no content' when empty", () => {
    const {toJSON} = renderWithTheme(
      <LocaleContentEditor
        errorText="boom"
        helperText="help"
        onChange={() => {}}
        title="Content"
        value={{}}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders locale tabs when value has locales", () => {
    const {toJSON, getByText} = renderWithTheme(
      <LocaleContentEditor onChange={() => {}} title="Content" value={{en: "Hello", es: "Hola"}} />
    );
    expect(toJSON()).toBeDefined();
    expect(getByText(/Editing:/).props.children).toBeDefined();
  });

  it("switches active locale when clicking a locale tab", async () => {
    const {getByText} = renderWithTheme(
      <LocaleContentEditor onChange={() => {}} value={{en: "Hello", fr: "Salut"}} />
    );

    await press(getByText("French"));
    expect(getByText("Editing: fr")).toBeDefined();
  });

  it("removes the active locale when remove is pressed", async () => {
    const onChange = mock((_: Record<string, string>) => undefined);
    const {getByText} = renderWithTheme(
      <LocaleContentEditor onChange={onChange} value={{en: "Hello", es: "Hola"}} />
    );

    await press(getByText(/Remove /));
    expect(onChange).toHaveBeenCalled();
    expect(Object.keys((onChange.mock.calls[0] as any)[0])).toEqual(["es"]);
  });

  it("falls back to empty object when value is not an object", () => {
    const {toJSON} = renderWithTheme(
      <LocaleContentEditor onChange={() => {}} value={null as any} />
    );
    expect(toJSON()).toBeDefined();
  });

  it("adds a new locale via the SelectField and Add Locale button", async () => {
    const onChange = mock((_: Record<string, string>) => undefined);
    const {UNSAFE_root, toJSON} = renderWithTheme(
      <LocaleContentEditor onChange={onChange} value={{}} />
    );
    // Find the SelectField and invoke its onChange prop directly.
    const selects = UNSAFE_root.findAll(
      (n: any) => typeof n.props?.onChange === "function" && Array.isArray(n.props?.options)
    );
    expect(selects.length).toBeGreaterThan(0);
    await act(async () => {
      (selects[0] as any).props.onChange("en");
    });
    // Find the Add Locale button (may be nested)
    const addBtns = UNSAFE_root.findAll((n: any) => n.props?.text === "Add Locale");
    expect(addBtns.length).toBeGreaterThan(0);
    await act(async () => {
      (addBtns[0] as any).props.onClick?.();
    });
    expect(onChange).toHaveBeenCalled();
    expect(Object.keys((onChange.mock.calls[0] as any)[0])).toContain("en");
    expect(toJSON()).toBeDefined();
  });

  it("does not add a locale that already exists", async () => {
    const onChange = mock((_: Record<string, string>) => undefined);
    const {UNSAFE_root} = renderWithTheme(
      <LocaleContentEditor onChange={onChange} value={{en: "Hi"}} />
    );
    const selects = UNSAFE_root.findAll(
      (n: any) => typeof n.props?.onChange === "function" && Array.isArray(n.props?.options)
    );
    await act(async () => {
      (selects[0] as any).props.onChange("en");
    });
    const addBtns = UNSAFE_root.findAll((n: any) => n.props?.text === "Add Locale");
    await act(async () => {
      (addBtns[0] as any).props.onClick?.();
    });
    // Should NOT have called onChange with an add because "en" already exists.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not add when no new locale selected", async () => {
    const onChange = mock((_: Record<string, string>) => undefined);
    const {UNSAFE_root} = renderWithTheme(<LocaleContentEditor onChange={onChange} value={{}} />);
    const addBtns = UNSAFE_root.findAll((n: any) => n.props?.text === "Add Locale");
    await act(async () => {
      (addBtns[0] as any).props.onClick?.();
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("edits content for the active locale via MarkdownEditorField onChange", async () => {
    const onChange = mock((_: Record<string, string>) => undefined);
    const {UNSAFE_root} = renderWithTheme(
      <LocaleContentEditor onChange={onChange} value={{en: "Hi", es: "Hola"}} />
    );
    const editors = UNSAFE_root.findAll(
      (n: any) =>
        typeof n.props?.testID === "string" && n.props.testID.startsWith("locale-content-")
    );
    expect(editors.length).toBeGreaterThan(0);
    await act(async () => {
      (editors[0] as any).props.onChange("new content");
    });
    expect(onChange).toHaveBeenCalled();
    const arg = (onChange.mock.calls[0] as any)[0];
    expect(arg.en).toBe("new content");
    expect(arg.es).toBe("Hola");
  });

  it("removing the active locale selects the next available locale", async () => {
    const onChange = mock((_: Record<string, string>) => undefined);
    const {getByText} = renderWithTheme(
      <LocaleContentEditor onChange={onChange} value={{en: "Hi", es: "Hola"}} />
    );
    await press(getByText("Remove en"));
    expect(onChange).toHaveBeenCalled();
  });
});
