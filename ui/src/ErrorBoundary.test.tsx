import {afterAll, beforeAll, describe, expect, it, mock, spyOn} from "bun:test";

import {ErrorBoundary} from "./ErrorBoundary";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("ErrorBoundary", () => {
  // Suppress console.warn during tests
  const originalWarn = console.warn;
  beforeAll(() => {
    console.warn = mock(() => {});
  });
  afterAll(() => {
    console.warn = originalWarn;
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
});
