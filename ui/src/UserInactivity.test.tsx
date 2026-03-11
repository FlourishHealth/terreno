import {describe, expect, it, mock} from "bun:test";
import {act} from "@testing-library/react-native";

import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";
import {UserInactivity} from "./UserInactivity";

describe("UserInactivity", () => {
  it("renders children correctly", () => {
    const onAction = mock((_active: boolean) => {});
    const {getByText} = renderWithTheme(
      <UserInactivity onAction={onAction}>
        <Text>Test Content</Text>
      </UserInactivity>
    );
    expect(getByText("Test Content")).toBeTruthy();
  });

  it("renders with custom style", () => {
    const onAction = mock((_active: boolean) => {});
    const {toJSON} = renderWithTheme(
      <UserInactivity onAction={onAction} style={{backgroundColor: "red", flex: 2}}>
        <Text>Test Content</Text>
      </UserInactivity>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with default style when no style provided", () => {
    const onAction = mock((_active: boolean) => {});
    const {toJSON} = renderWithTheme(
      <UserInactivity onAction={onAction}>
        <Text>Test Content</Text>
      </UserInactivity>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("calls onAction with false after timeout", async () => {
    const onAction = mock((_active: boolean) => {});

    renderWithTheme(
      <UserInactivity onAction={onAction} timeForInactivity={50}>
        <Text>Test Content</Text>
      </UserInactivity>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(onAction).toHaveBeenCalledWith(false);
  });

  it("accepts timeForInactivity prop", () => {
    const onAction = mock((_active: boolean) => {});
    const {toJSON} = renderWithTheme(
      <UserInactivity onAction={onAction} timeForInactivity={5000}>
        <Text>Test Content</Text>
      </UserInactivity>
    );
    expect(toJSON()).toBeTruthy();
  });

  it("accepts isActive prop", () => {
    const onAction = mock((_active: boolean) => {});
    const {toJSON} = renderWithTheme(
      <UserInactivity isActive={true} onAction={onAction}>
        <Text>Test Content</Text>
      </UserInactivity>
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders multiple children", () => {
    const onAction = mock((_active: boolean) => {});
    const {getByText} = renderWithTheme(
      <UserInactivity onAction={onAction}>
        <Text>First Child</Text>
        <Text>Second Child</Text>
      </UserInactivity>
    );
    expect(getByText("First Child")).toBeTruthy();
    expect(getByText("Second Child")).toBeTruthy();
  });

  it("accepts skipKeyboard prop", () => {
    const onAction = mock((_active: boolean) => {});
    const {toJSON} = renderWithTheme(
      <UserInactivity onAction={onAction} skipKeyboard={true}>
        <Text>Test Content</Text>
      </UserInactivity>
    );
    expect(toJSON()).toBeTruthy();
  });
});
