import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {renderWithTheme} from "../test-utils";
import {LoginScreen} from "./LoginScreen";

const defaultFields = [
  {label: "Email", name: "email", required: true, type: "email" as const},
  {label: "Password", name: "password", required: true, type: "password" as const},
];

describe("LoginScreen", () => {
  it("renders with default props", () => {
    const {getByTestId} = renderWithTheme(
      <LoginScreen fields={defaultFields} onSubmit={mock(() => Promise.resolve())} />
    );
    expect(getByTestId("login-screen")).toBeTruthy();
  });

  it("renders title", () => {
    const {getByTestId} = renderWithTheme(
      <LoginScreen fields={defaultFields} onSubmit={mock(() => Promise.resolve())} />
    );
    expect(getByTestId("login-screen-title")).toBeTruthy();
  });

  it("renders custom title", () => {
    const {getByText} = renderWithTheme(
      <LoginScreen
        fields={defaultFields}
        onSubmit={mock(() => Promise.resolve())}
        title="Sign In"
      />
    );
    expect(getByText("Sign In")).toBeTruthy();
  });

  it("renders all form fields", () => {
    const {getByTestId} = renderWithTheme(
      <LoginScreen fields={defaultFields} onSubmit={mock(() => Promise.resolve())} />
    );
    expect(getByTestId("login-screen-email-input")).toBeTruthy();
    expect(getByTestId("login-screen-password-input")).toBeTruthy();
  });

  it("renders submit button", () => {
    const {getByTestId} = renderWithTheme(
      <LoginScreen fields={defaultFields} onSubmit={mock(() => Promise.resolve())} />
    );
    expect(getByTestId("login-screen-submit-button")).toBeTruthy();
  });

  it("renders sign-up link when onSignUpPress is provided", () => {
    const {getByTestId} = renderWithTheme(
      <LoginScreen
        fields={defaultFields}
        onSignUpPress={() => {}}
        onSubmit={mock(() => Promise.resolve())}
      />
    );
    expect(getByTestId("login-screen-signup-link")).toBeTruthy();
  });

  it("renders forgot password button when onForgotPasswordPress is provided", () => {
    const {getByTestId} = renderWithTheme(
      <LoginScreen
        fields={defaultFields}
        onForgotPasswordPress={() => {}}
        onSubmit={mock(() => Promise.resolve())}
      />
    );
    expect(getByTestId("login-screen-forgot-password")).toBeTruthy();
  });

  it("renders error message", () => {
    const {getByTestId} = renderWithTheme(
      <LoginScreen
        error="Invalid credentials"
        fields={defaultFields}
        onSubmit={mock(() => Promise.resolve())}
      />
    );
    expect(getByTestId("login-screen-error")).toBeTruthy();
  });

  it("renders OAuth buttons when providers are given", () => {
    const providers = [
      {onPress: mock(() => Promise.resolve()), provider: "google" as const},
      {onPress: mock(() => Promise.resolve()), provider: "github" as const},
    ];
    const {getByTestId} = renderWithTheme(
      <LoginScreen
        fields={defaultFields}
        oauthProviders={providers}
        onSubmit={mock(() => Promise.resolve())}
      />
    );
    expect(getByTestId("login-screen-oauth")).toBeTruthy();
  });

  it("updates form field values on change", () => {
    const {getByTestId} = renderWithTheme(
      <LoginScreen fields={defaultFields} onSubmit={mock(() => Promise.resolve())} />
    );
    const emailInput = getByTestId("login-screen-email-input");
    fireEvent.changeText(emailInput, "test@example.com");
    expect(emailInput.props.value).toBe("test@example.com");
  });

  it("renders with custom testID", () => {
    const {getByTestId} = renderWithTheme(
      <LoginScreen
        fields={defaultFields}
        onSubmit={mock(() => Promise.resolve())}
        testID="custom-login"
      />
    );
    expect(getByTestId("custom-login")).toBeTruthy();
  });

  it("does not render forgot password when handler not provided", () => {
    const {queryByTestId} = renderWithTheme(
      <LoginScreen fields={defaultFields} onSubmit={mock(() => Promise.resolve())} />
    );
    expect(queryByTestId("login-screen-forgot-password")).toBeNull();
  });

  it("does not render sign-up link when handler not provided", () => {
    const {queryByTestId} = renderWithTheme(
      <LoginScreen fields={defaultFields} onSubmit={mock(() => Promise.resolve())} />
    );
    expect(queryByTestId("login-screen-signup-link")).toBeNull();
  });

  it("renders correctly with all props", () => {
    const {toJSON} = renderWithTheme(
      <LoginScreen
        error="Error!"
        fields={defaultFields}
        loading
        onForgotPasswordPress={() => {}}
        onSignUpPress={() => {}}
        onSubmit={mock(() => Promise.resolve())}
        title="Log In"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
