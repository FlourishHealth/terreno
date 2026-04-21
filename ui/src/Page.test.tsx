import {afterAll, describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";
import {Pressable, Text as RNText} from "react-native";

// Override the IconButton mock so the inline onClick arrows fire when pressed.
mock.module("./IconButton", () => ({
  IconButton: ({
    accessibilityLabel,
    accessibilityHint,
    iconName,
    onClick,
  }: {
    accessibilityLabel?: string;
    accessibilityHint?: string;
    iconName: string;
    onClick?: () => void;
  }) => (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      onPress={onClick}
      testID={`icon-button-${iconName}`}
    >
      <RNText>{iconName}</RNText>
    </Pressable>
  ),
}));

const routerBack = mock(() => {});
mock.module("expo-router", () => ({
  router: {back: routerBack},
}));

import {Page} from "./Page";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

// Restore the global null IconButton mock after this file finishes so that other
// test files that expect the bunSetup.ts mock (e.g. IconButton.test.tsx) are not
// affected by the override above.
afterAll(() => {
  mock.module("./IconButton", () => ({
    IconButton: mock(() => null),
  }));
});

describe("Page", () => {
  const mockNavigation = {
    goBack: mock(() => {}),
  };

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(
      <Page navigation={mockNavigation}>
        <Text>Page content</Text>
      </Page>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders children correctly", () => {
    const {getByText} = renderWithTheme(
      <Page navigation={mockNavigation}>
        <Text>Test content</Text>
      </Page>
    );
    expect(getByText("Test content")).toBeTruthy();
  });

  it("renders with title", () => {
    const {getByText, toJSON} = renderWithTheme(
      <Page navigation={mockNavigation} title="Page Title">
        <Text>Content</Text>
      </Page>
    );
    expect(getByText("Page Title")).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with back button", () => {
    const {toJSON} = renderWithTheme(
      <Page backButton navigation={mockNavigation} title="Page">
        <Text>Content</Text>
      </Page>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with close button", () => {
    const {toJSON} = renderWithTheme(
      <Page closeButton navigation={mockNavigation} title="Page">
        <Text>Content</Text>
      </Page>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with right button", () => {
    const handleRightClick = mock(() => {});
    const {getByText, toJSON} = renderWithTheme(
      <Page
        navigation={mockNavigation}
        rightButton="Save"
        rightButtonOnClick={handleRightClick}
        title="Page"
      >
        <Text>Content</Text>
      </Page>
    );
    expect(getByText("Save")).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders loading state", () => {
    const {toJSON} = renderWithTheme(
      <Page loading navigation={mockNavigation}>
        <Text>Content</Text>
      </Page>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with footer", () => {
    const {getByText, toJSON} = renderWithTheme(
      <Page footer={<Text>Footer content</Text>} navigation={mockNavigation}>
        <Text>Content</Text>
      </Page>
    );
    expect(getByText("Footer content")).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom padding", () => {
    const {toJSON} = renderWithTheme(
      <Page navigation={mockNavigation} padding={5}>
        <Text>Content</Text>
      </Page>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom color", () => {
    const {toJSON} = renderWithTheme(
      <Page color="secondary" navigation={mockNavigation}>
        <Text>Content</Text>
      </Page>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with scroll disabled", () => {
    const {toJSON} = renderWithTheme(
      <Page navigation={mockNavigation} scroll={false}>
        <Text>Content</Text>
      </Page>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom maxWidth", () => {
    const {toJSON} = renderWithTheme(
      <Page maxWidth={600} navigation={mockNavigation}>
        <Text>Content</Text>
      </Page>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("invokes rightButtonOnClick when right button is pressed", async () => {
    const handleRightClick = mock(() => {});
    const {getByText} = renderWithTheme(
      <Page
        navigation={mockNavigation}
        rightButton="Save"
        rightButtonOnClick={handleRightClick}
        title="Page"
      >
        <Text>Content</Text>
      </Page>
    );
    await act(async () => {
      fireEvent.press(getByText("Save"));
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    await waitFor(() => expect(handleRightClick).toHaveBeenCalled());
  });

  it("renders without header when title and backButton are both absent", () => {
    const {queryByText} = renderWithTheme(
      <Page navigation={mockNavigation}>
        <Text>Plain page</Text>
      </Page>
    );
    expect(queryByText("Plain page")).toBeTruthy();
  });

  it("renders loading state with loadingText", () => {
    const {getByText} = renderWithTheme(
      <Page loading loadingText="Loading data..." navigation={mockNavigation}>
        <Text>Content</Text>
      </Page>
    );
    expect(getByText("Loading data...")).toBeTruthy();
  });

  it("invokes router.back when the back button is pressed", () => {
    routerBack.mockClear();
    const {getByTestId} = renderWithTheme(
      <Page backButton navigation={mockNavigation} title="Page">
        <Text>Content</Text>
      </Page>
    );
    fireEvent.press(getByTestId("icon-button-chevron-left"));
    expect(routerBack).toHaveBeenCalled();
  });

  it("invokes router.back when the close button is pressed", () => {
    routerBack.mockClear();
    const {getByTestId} = renderWithTheme(
      <Page closeButton navigation={mockNavigation} title="Page">
        <Text>Content</Text>
      </Page>
    );
    fireEvent.press(getByTestId("icon-button-xmark"));
    expect(routerBack).toHaveBeenCalled();
  });

  it("safely handles a missing rightButtonOnClick callback", async () => {
    const {getByText} = renderWithTheme(
      <Page navigation={mockNavigation} rightButton="Go" title="Page">
        <Text>Content</Text>
      </Page>
    );
    await act(async () => {
      fireEvent.press(getByText("Go"));
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    // No crash; the optional-chained call handles the missing prop.
    expect(getByText("Go")).toBeTruthy();
  });
});
