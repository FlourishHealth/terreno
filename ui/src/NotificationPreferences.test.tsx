import {describe, it} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {assert} from "chai";

import {NotificationPreferences} from "./NotificationPreferences";
import {renderWithTheme} from "./test-utils";

describe("NotificationPreferences", () => {
  it("calls onChange when mail is toggled", () => {
    let changedChannel: string | undefined;
    let changedValue: boolean | undefined;
    const {getByTestId} = renderWithTheme(
      <NotificationPreferences
        onChange={(channel, value) => {
          changedChannel = channel;
          changedValue = value;
        }}
        preferences={{inapp: true, mail: true, push: true, sms: true}}
      />
    );
    fireEvent.press(getByTestId("notification-preferences-mail.switch"));
    assert.equal(changedChannel, "mail");
    assert.equal(changedValue, false);
  });
});
