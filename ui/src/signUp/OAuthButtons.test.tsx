import {describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "../test-utils";
import {OAuthButtons} from "./OAuthButtons";

describe("OAuthButtons", () => {
  const mockProviders = [
    {onPress: mock(() => Promise.resolve()), provider: "google" as const},
    {onPress: mock(() => Promise.resolve()), provider: "github" as const},
    {onPress: mock(() => Promise.resolve()), provider: "apple" as const},
  ];

  it("renders all provider buttons", () => {
    const {getByTestId} = renderWithTheme(
      <OAuthButtons providers={mockProviders} testID="oauth" />
    );
    expect(getByTestId("oauth")).toBeTruthy();
    expect(getByTestId("oauth-google")).toBeTruthy();
    expect(getByTestId("oauth-github")).toBeTruthy();
    expect(getByTestId("oauth-apple")).toBeTruthy();
  });

  it("renders nothing when providers is empty", () => {
    const {queryByTestId} = renderWithTheme(<OAuthButtons providers={[]} testID="oauth" />);
    expect(queryByTestId("oauth")).toBeNull();
  });

  it("renders with custom divider text", () => {
    const {getByText} = renderWithTheme(
      <OAuthButtons dividerText="Sign in with" providers={mockProviders} />
    );
    expect(getByText("Sign in with")).toBeTruthy();
  });

  it("renders default divider text", () => {
    const {getByText} = renderWithTheme(<OAuthButtons providers={mockProviders} />);
    expect(getByText("Or continue with")).toBeTruthy();
  });

  it("renders correctly with all props", () => {
    const {toJSON} = renderWithTheme(
      <OAuthButtons disabled providers={mockProviders} testID="oauth" />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
