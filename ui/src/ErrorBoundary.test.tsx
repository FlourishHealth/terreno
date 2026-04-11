import {afterAll, beforeAll, beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";

import {ErrorBoundary} from "./ErrorBoundary";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

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
    // No-op hook kept to preserve test lifecycle shape.
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

  it("renders fallback UI and calls onError when boundary captures an error", async () => {
    const handleError = mock(() => {});
    const {UNSAFE_getByType, getByText} = renderWithTheme(
      <ErrorBoundary onError={handleError}>
        <Text>Recovered child</Text>
      </ErrorBoundary>
    );
    const error = new Error("Boundary crash");
    const boundaryInstance = UNSAFE_getByType(ErrorBoundary).instance as ErrorBoundary;

    act(() => {
      boundaryInstance.setState(ErrorBoundary.getDerivedStateFromError(error));
      boundaryInstance.componentDidCatch(error, {componentStack: "\n    at ThrowingChild"});
    });

    await waitFor(() => expect(getByText("Oops!")).toBeTruthy());
    expect(getByText("Error: Boundary crash")).toBeTruthy();
    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(handleError.mock.calls[0][1]).toContain("ThrowingChild");
  });

  it("resets error state when pressing try again", async () => {
    const {UNSAFE_getByType, getByText, queryByText} = renderWithTheme(
      <ErrorBoundary>
        <Text>Recovered child</Text>
      </ErrorBoundary>
    );
    const boundaryInstance = UNSAFE_getByType(ErrorBoundary).instance as ErrorBoundary;

    act(() => {
      boundaryInstance.setState(
        ErrorBoundary.getDerivedStateFromError(new Error("Boundary crash"))
      );
    });

    await waitFor(() => expect(getByText("Oops!")).toBeTruthy());
    fireEvent.press(getByText("Try again"));
    await waitFor(() => expect(queryByText("Oops!")).toBeNull());
    expect(getByText("Recovered child")).toBeTruthy();
  });
});
