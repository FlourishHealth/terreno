import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";

import {Banner} from "./Banner";
import {renderWithTheme} from "./test-utils";

describe("Banner", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<Banner id="test-banner" text="Test message" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders text content correctly", () => {
    const {getByText} = renderWithTheme(<Banner id="test-banner" text="Important notice" />);
    expect(getByText("Important notice")).toBeTruthy();
  });

  it("renders with info status (default)", () => {
    const {toJSON} = renderWithTheme(<Banner id="test-banner" status="info" text="Info message" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with alert status", () => {
    const {toJSON} = renderWithTheme(
      <Banner id="test-banner" status="alert" text="Alert message" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with warning status", () => {
    const {toJSON} = renderWithTheme(
      <Banner id="test-banner" status="warning" text="Warning message" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with icon when hasIcon is true", () => {
    const {toJSON} = renderWithTheme(<Banner hasIcon id="test-banner" text="With icon" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders dismissible banner with dismiss button", () => {
    const {getByLabelText} = renderWithTheme(
      <Banner dismissible id="test-banner" text="Dismissible" />
    );
    expect(getByLabelText("Dismiss")).toBeTruthy();
  });

  it("hides banner when dismiss button is clicked", async () => {
    const {getByLabelText, queryByText} = renderWithTheme(
      <Banner dismissible id="test-dismiss-banner" text="Dismissible banner" />
    );

    await act(async () => {
      fireEvent.press(getByLabelText("Dismiss"));
    });

    await waitFor(() => {
      expect(queryByText("Dismissible banner")).toBeNull();
    });
  });

  it("renders with button", async () => {
    const handleClick = mock(() => Promise.resolve());
    const {getByText, toJSON} = renderWithTheme(
      <Banner
        buttonOnClick={handleClick}
        buttonText="Action"
        id="test-banner"
        text="Banner with button"
      />
    );
    expect(toJSON()).toMatchSnapshot();
    expect(getByText("Action")).toBeTruthy();
  });

  it("renders with button and icon", () => {
    const handleClick = mock(() => Promise.resolve());
    const {toJSON} = renderWithTheme(
      <Banner
        buttonIconName="arrow-right"
        buttonOnClick={handleClick}
        buttonText="Go"
        id="test-banner"
        text="Banner with button and icon"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("calls buttonOnClick when button is pressed", async () => {
    const handleClick = mock(() => Promise.resolve());
    const {getByText} = renderWithTheme(
      <Banner buttonOnClick={handleClick} buttonText="Click me" id="test-banner" text="Banner" />
    );

    await act(async () => {
      fireEvent.press(getByText("Click me"));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(handleClick).toHaveBeenCalled();
    });
  });
});
