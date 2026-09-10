import {describe, it} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {assert} from "chai";

import {NotificationBell} from "./NotificationBell";
import {renderWithTheme} from "./test-utils";

describe("NotificationBell", () => {
  it("hides the badge when unreadCount is zero", () => {
    const {queryByTestId} = renderWithTheme(
      <NotificationBell onPress={() => {}} testID="bell" unreadCount={0} />
    );
    assert.isNull(queryByTestId("bell-badge"));
    assert.isOk(queryByTestId("bell-button"));
  });

  it("shows a badge when unreadCount is positive", () => {
    const {getByTestId} = renderWithTheme(
      <NotificationBell onPress={() => {}} testID="bell" unreadCount={3} />
    );
    assert.isOk(getByTestId("bell-button"));
  });

  it("calls onPress when tapped", () => {
    let pressed = false;
    const {getByTestId} = renderWithTheme(
      <NotificationBell
        onPress={() => {
          pressed = true;
        }}
        testID="bell"
        unreadCount={2}
      />
    );
    fireEvent.press(getByTestId("bell-button"));
    assert.isTrue(pressed);
  });
});
