import {fireEvent} from "@testing-library/react-native";
import {afterAll, beforeAll, beforeEach, describe, expect, it, mock} from "bun:test";

import {ErrorBoundary} from "./ErrorBoundary";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

let shouldThrow = false;

const ThrowingChild = () => {
  if (shouldThrow) {
    shouldThrow = false;
    throw new Error("Boundary crash");
  }
  return <Text>Recovered child</Text>;
};

describe("ErrorBoundary", () => {
  // Suppress console.warn during tests
  const originalWarn = console.warn;
  const originalError = console.error;
  beforeAll(() => {
    console.warn = mock(() => {});
    console.error = mock(() => {});
  });
  afterAll(() => {
    console.warn = originalWarn;
    console.error = originalError;
  });
  beforeEach(() => {
    shouldThrow = false;
  });

  it("renders children when no error", () => {
    const {getByText} = renderWithTheme(
      <ErrorBoundary>
        <Text>Child content</Text>
      </ErrorBoundary>
    );
    expect(getByText("Child content")).toBeTruthy();
  });

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(
      <ErrorBoundary>
        <Text>Content</Text>
      </ErrorBoundary>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("accepts onError callback prop", () => {
    const handleError = mock(() => {});
    const {toJSON} = renderWithTheme(
      <ErrorBoundary onError={handleError}>
        <Text>Content</Text>
      </ErrorBoundary>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders fallback UI and calls onError when a child throws", () => {
    shouldThrow = true;
    const handleError = mock(() => {});
    const {getByText} = renderWithTheme(
      <ErrorBoundary onError={handleError}>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(getByText("Oops!")).toBeTruthy();
    expect(getByText("Error: Boundary crash")).toBeTruthy();
    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(handleError.mock.calls[0][1]).toContain("ThrowingChild");
  });

  it("resets error state when pressing try again", () => {
    shouldThrow = true;
    const {getByText} = renderWithTheme(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(getByText("Oops!")).toBeTruthy();
    fireEvent.press(getByText("Try again"));
    expect(getByText("Recovered child")).toBeTruthy();
  });
});
