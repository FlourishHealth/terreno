import {describe, it} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import {StyleSheet} from "react-native";

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
    assert.isOk(getByTestId("bell-badge"));
    assert.include(StyleSheet.flatten(getByTestId("bell").props.style), {
      position: "relative",
    });
    assert.include(StyleSheet.flatten(getByTestId("bell-badge-container").props.style), {
      position: "absolute",
      right: -4,
      top: -4,
    });
    assert.equal(getByTestId("bell-badge-container").props.pointerEvents, "none");
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
