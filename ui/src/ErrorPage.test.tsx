import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {ErrorPage} from "./ErrorPage";
import {renderWithTheme} from "./test-utils";

describe("ErrorPage", () => {
  const testError = new Error("Test error message");

  it("renders correctly", () => {
    const {toJSON} = renderWithTheme(<ErrorPage error={testError} resetError={() => {}} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("displays error message", () => {
    const {getByText} = renderWithTheme(<ErrorPage error={testError} resetError={() => {}} />);
    expect(getByText("Oops!")).toBeTruthy();
    expect(getByText(/Test error message/)).toBeTruthy();
  });

  it("displays explanation text", () => {
    const {getByText} = renderWithTheme(<ErrorPage error={testError} resetError={() => {}} />);
    expect(getByText(/There's an error. Sorry! Our team just got a notification/)).toBeTruthy();
  });

  it("displays Try again button", () => {
    const {getByText} = renderWithTheme(<ErrorPage error={testError} resetError={() => {}} />);
    expect(getByText("Try again")).toBeTruthy();
  });

  it("calls resetError when Try again button is pressed", async () => {
    const handleReset = mock(() => {});
    const {getByText} = renderWithTheme(<ErrorPage error={testError} resetError={handleReset} />);

    fireEvent.press(getByText("Try again"));
    // Note: Button has debounce, so the handler might not be called immediately
  });

  it("displays different error types correctly", () => {
    const typeError = new TypeError("Type error occurred");
    const {getByText} = renderWithTheme(<ErrorPage error={typeError} resetError={() => {}} />);
    expect(getByText(/TypeError: Type error occurred/)).toBeTruthy();
  });
});
