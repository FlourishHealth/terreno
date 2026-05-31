const platform = process.env.APPIUM_PLATFORM ?? "web";

export const TEST_USER = {
  email: "test@example.com",
  password: "testpassword123",
};

export const SIGNUP_PASSWORD = "TestPassword123!";

export const byTestId = (id: string): string =>
  platform === "ios" ? `~${id}` : `[data-testid="${id}"]`;

export const byText = (text: string): string =>
  platform === "ios"
    ? `-ios predicate string:name == "${text}" OR label == "${text}" OR value == "${text}"`
    : `//*[contains(text(), "${text}")]`;
