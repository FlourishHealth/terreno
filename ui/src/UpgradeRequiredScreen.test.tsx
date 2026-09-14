import {describe, expect, it, mock} from "bun:test";
import {fireEvent, waitFor} from "@testing-library/react-native";

import {renderWithTheme} from "./test-utils";
import {UpgradeRequiredScreen} from "./UpgradeRequiredScreen";

describe("UpgradeRequiredScreen", () => {
  it("renders the heading, message, and update button by default", () => {
    const {getByText} = renderWithTheme(
      <UpgradeRequiredScreen message="A new version is available" onUpdate={() => {}} />
    );

    expect(getByText("Update Required")).toBeTruthy();
    expect(getByText("A new version is available")).toBeTruthy();
    expect(getByText("Update")).toBeTruthy();
  });

  it("invokes onUpdate when the update button is pressed", async () => {
    const onUpdate = mock(() => {});
    const {getByText} = renderWithTheme(
      <UpgradeRequiredScreen canUpdate message="Please update now" onUpdate={onUpdate} />
    );

    fireEvent.press(getByText("Update"));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledTimes(1);
    });
  });

  it("shows contact-support text instead of the button when canUpdate is false", () => {
    const {getByText, queryByText} = renderWithTheme(
      <UpgradeRequiredScreen canUpdate={false} message="No update path" onUpdate={() => {}} />
    );

    expect(getByText("No update path")).toBeTruthy();
    expect(getByText("Please contact support or check your app store for an update.")).toBeTruthy();
    expect(queryByText("Update")).toBeNull();
  });
});
