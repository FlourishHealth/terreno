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
    assert.equal(getByTestId("bell-badge-container").props.pointerEvents, "none");
  });

  it("keeps the badge inside the bell bounds so ancestors cannot clip it", () => {
    const {getByTestId} = renderWithTheme(
      <NotificationBell onPress={() => {}} testID="bell" unreadCount={3} />
    );

    const wrapper = StyleSheet.flatten(getByTestId("bell").props.style);
    const badgeContainer = StyleSheet.flatten(getByTestId("bell-badge-container").props.style);

    assert.isAtLeast(Number(wrapper.width), 40);
    assert.isAtLeast(Number(wrapper.height), 40);
    assert.include(badgeContainer, {position: "absolute", right: 0, top: 0});
  });

  it("announces the unread count to assistive technology", () => {
    const {getByTestId, rerender} = renderWithTheme(
      <NotificationBell onPress={() => {}} testID="bell" unreadCount={1} />
    );
    assert.equal(
      getByTestId("bell-button").props.accessibilityLabel,
      "Notifications, 1 unread notification"
    );

    rerender(<NotificationBell onPress={() => {}} testID="bell" unreadCount={0} />);
    assert.equal(getByTestId("bell-button").props.accessibilityLabel, "Notifications");
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
