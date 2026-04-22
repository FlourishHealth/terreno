import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {Linking} from "react-native";

import {formatAddress, TapToEdit} from "./TapToEdit";
import {renderWithTheme} from "./test-utils";

describe("TapToEdit", () => {
  it("renders correctly with text value", () => {
    const {toJSON} = renderWithTheme(
      <TapToEdit setValue={() => {}} title="Name" value="John Doe" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("displays title and value", () => {
    const {getByText} = renderWithTheme(
      <TapToEdit setValue={() => {}} title="Email" value="test@example.com" />
    );
    expect(getByText("Email")).toBeTruthy();
    expect(getByText("test@example.com")).toBeTruthy();
  });

  it("renders non-editable when editable is false", () => {
    const {toJSON} = renderWithTheme(
      <TapToEdit editable={false} title="Read Only" value="Cannot edit this" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders edit icon when editable", () => {
    const {toJSON} = renderWithTheme(
      <TapToEdit editable setValue={() => {}} title="Editable Field" value="Click to edit" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("shows editing mode when isEditing is true", () => {
    const {toJSON} = renderWithTheme(
      <TapToEdit isEditing setValue={() => {}} title="Field" value="Editing..." />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("displays helper text when provided", () => {
    const {toJSON} = renderWithTheme(
      <TapToEdit
        helperText="Enter your full name"
        onlyShowHelperTextWhileEditing={false}
        setValue={() => {}}
        title="Name"
        value=""
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with boolean type showing Yes/No", () => {
    const {getByText} = renderWithTheme(
      <TapToEdit editable={false} title="Active" type="boolean" value={true} />
    );
    expect(getByText("Yes")).toBeTruthy();
  });

  it("renders with boolean type showing No when false", () => {
    const {getByText} = renderWithTheme(
      <TapToEdit editable={false} title="Active" type="boolean" value={false} />
    );
    expect(getByText("No")).toBeTruthy();
  });

  it("renders with transform function", () => {
    const {getByText} = renderWithTheme(
      <TapToEdit
        editable={false}
        title="Custom"
        transform={(val) => `Transformed: ${val}`}
        value="data"
      />
    );
    expect(getByText("Transformed: data")).toBeTruthy();
  });

  it("renders with textarea type", () => {
    const {toJSON} = renderWithTheme(
      <TapToEdit
        editable={false}
        title="Description"
        type="textarea"
        value="This is a long description that spans multiple lines."
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders multiselect type as comma-joined string", () => {
    const {getByText} = renderWithTheme(
      <TapToEdit editable={false} title="Tags" type="multiselect" value={["a", "b", "c"]} />
    );
    expect(getByText("a, b, c")).toBeTruthy();
  });

  it("renders url type showing hostname for a valid URL", () => {
    const {getByText} = renderWithTheme(
      <TapToEdit editable={false} title="Website" type="url" value="https://example.com/foo" />
    );
    expect(getByText("example.com")).toBeTruthy();
  });

  it("renders url type falling back to raw value for invalid URL", () => {
    const {getByText} = renderWithTheme(
      <TapToEdit editable={false} title="Website" type="url" value="not-a-url" />
    );
    expect(getByText("not-a-url")).toBeTruthy();
  });

  it("renders url type with empty value without logging error", () => {
    const {toJSON} = renderWithTheme(
      <TapToEdit editable={false} title="Website" type="url" value="" />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders address type using formatAddress", () => {
    const {getByText} = renderWithTheme(
      <TapToEdit
        editable={false}
        title="Home"
        type="address"
        value={{
          address1: "123 Main St",
          city: "Boston",
          state: "MA",
          zipcode: "02101",
        }}
      />
    );
    expect(getByText(/123 Main St/)).toBeTruthy();
  });

  it("invokes Linking.openURL for url type when clicked", async () => {
    const originalOpen = Linking.openURL;
    const openMock = mock(() => Promise.resolve(true));
    (Linking as any).openURL = openMock;

    const {getByLabelText} = renderWithTheme(
      <TapToEdit editable={false} title="Site" type="url" value="https://example.com" />
    );

    await act(async () => {
      fireEvent.press(getByLabelText("Link"));
    });
    expect(openMock).toHaveBeenCalled();

    (Linking as any).openURL = originalOpen;
  });

  it("invokes Linking.openURL with google maps for address type when clicked", async () => {
    const originalOpen = Linking.openURL;
    const openMock = mock(() => Promise.resolve(true));
    (Linking as any).openURL = openMock;

    const {getByLabelText} = renderWithTheme(
      <TapToEdit
        editable={false}
        title="Home"
        type="address"
        value={{address1: "1 Market St", city: "SF", state: "CA", zipcode: "94105"}}
      />
    );

    await act(async () => {
      fireEvent.press(getByLabelText("Link"));
    });
    expect(openMock).toHaveBeenCalled();
    const arg = openMock.mock.calls[0][0];
    expect(arg).toContain("google.com/maps");

    (Linking as any).openURL = originalOpen;
  });

  it("throws when editable is true and setValue is not provided", () => {
    expect(() =>
      renderWithTheme(<TapToEdit editable title="Required Save" value="foo" />)
    ).toThrow();
  });

  it("enters editing mode when Edit button is pressed", async () => {
    const setValue = mock(() => {});
    const {getByLabelText, queryByText} = renderWithTheme(
      <TapToEdit setValue={setValue} title="Name" value="Jane" />
    );
    await act(async () => {
      fireEvent.press(getByLabelText("Edit"));
    });
    expect(queryByText("Cancel")).toBeTruthy();
    expect(queryByText("Save")).toBeTruthy();
  });

  it("calls setValue with initial value and exits editing on Cancel", async () => {
    const setValue = mock(() => {});
    const {getByLabelText, getByText} = renderWithTheme(
      <TapToEdit setValue={setValue} title="Name" value="Jane" />
    );
    await act(async () => {
      fireEvent.press(getByLabelText("Edit"));
    });
    await act(async () => {
      fireEvent.press(getByText("Cancel"));
    });
    expect(setValue).toHaveBeenCalled();
  });

  it("clears value when Clear button is pressed", async () => {
    const setValue = mock(() => {});
    const onSave = mock(() => Promise.resolve());
    const {getByLabelText, getByText} = renderWithTheme(
      <TapToEdit onSave={onSave} setValue={setValue} showClearButton title="Name" value="Jane" />
    );
    await act(async () => {
      fireEvent.press(getByLabelText("Edit"));
    });
    await act(async () => {
      fireEvent.press(getByText("Clear"));
    });
    expect(setValue).toHaveBeenCalledWith("");
    expect(onSave).toHaveBeenCalledWith("");
  });

  it("calls onSave when Save is pressed", async () => {
    const setValue = mock(() => {});
    const onSave = mock(() => Promise.resolve());
    const {getByLabelText, getByText} = renderWithTheme(
      <TapToEdit onSave={onSave} setValue={setValue} title="Name" value="Jane" />
    );
    await act(async () => {
      fireEvent.press(getByLabelText("Edit"));
    });
    await act(async () => {
      fireEvent.press(getByText("Save"));
    });
    expect(onSave).toHaveBeenCalledWith("Jane");
  });

  it("logs error when saving without onSave", async () => {
    const setValue = mock(() => {});
    const originalError = console.error;
    const errorMock = mock(() => {});
    console.error = errorMock;

    const {getByLabelText, getByText} = renderWithTheme(
      <TapToEdit setValue={setValue} title="Name" value="Jane" />
    );
    await act(async () => {
      fireEvent.press(getByLabelText("Edit"));
    });
    await act(async () => {
      fireEvent.press(getByText("Save"));
    });
    expect(errorMock).toHaveBeenCalled();
    console.error = originalError;
  });
});

describe("formatAddress", () => {
  it("formats full address correctly", () => {
    const address = {
      address1: "123 Main St",
      address2: "Apt 4",
      city: "New York",
      state: "NY",
      zipcode: "10001",
    };
    const result = formatAddress(address);
    expect(result).toContain("123 Main St");
    expect(result).toContain("Apt 4");
    expect(result).toContain("New York");
    expect(result).toContain("NY");
    expect(result).toContain("10001");
  });

  it("formats address as string when asString is true", () => {
    const address = {
      address1: "123 Main St",
      city: "Boston",
      state: "MA",
      zipcode: "02101",
    };
    const result = formatAddress(address, true);
    expect(result).toContain(",");
    expect(result).not.toContain("\n");
  });

  it("handles partial address", () => {
    const address = {
      city: "Chicago",
      state: "IL",
    };
    const result = formatAddress(address);
    expect(result).toContain("Chicago");
    expect(result).toContain("IL");
  });

  it("includes county information when provided", () => {
    const address = {
      address1: "100 County Rd",
      city: "Rural Town",
      countyCode: "113",
      countyName: "Dallas County",
      state: "TX",
      zipcode: "75001",
    };
    const result = formatAddress(address);
    expect(result).toContain("Dallas County");
    expect(result).toContain("(113)");
  });
});
