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
    const {getByTestId} = renderWithTheme(<AdminScreenPage title="Example" />);

    assert.exists(getByTestId("icon-button-chevron-left"));
  });

  it("allows hosts to disable the back arrow", (): void => {
    const {queryByTestId} = renderWithTheme(
      <AdminScreenPage backButton={false} title="Example" />
    );

    assert.isNull(queryByTestId("icon-button-chevron-left"));
  });
});
