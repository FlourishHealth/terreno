import {describe, it, mock} from "bun:test";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import {AdminScreenPage} from "./AdminScreenPage";

mock.module("expo-router", () => ({
  router: {back: mock(() => {})},
}));

describe("AdminScreenPage", () => {
  it("shows a back arrow by default", (): void => {
    const {getByA11yHint} = renderWithTheme(<AdminScreenPage title="Example" />);

    assert.exists(getByA11yHint("Navigate back"));
  });

  it("allows hosts to disable the back arrow", (): void => {
    const {queryByA11yHint} = renderWithTheme(
      <AdminScreenPage backButton={false} title="Example" />
    );

    assert.isNull(queryByA11yHint("Navigate back"));
  });
});
