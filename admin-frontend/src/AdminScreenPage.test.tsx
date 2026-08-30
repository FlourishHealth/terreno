import {describe, it, mock} from "bun:test";
import {Page} from "@terreno/ui";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import {AdminScreenPage} from "./AdminScreenPage";

mock.module("expo-router", () => ({
  router: {back: mock(() => {})},
}));

describe("AdminScreenPage", () => {
  it("shows a back arrow by default", (): void => {
    const {UNSAFE_root} = renderWithTheme(<AdminScreenPage title="Example" />);

    assert.isTrue(UNSAFE_root.findByType(Page).props.backButton);
  });

  it("allows hosts to disable the back arrow", (): void => {
    const {UNSAFE_root} = renderWithTheme(<AdminScreenPage backButton={false} title="Example" />);

    assert.isFalse(UNSAFE_root.findByType(Page).props.backButton);
  });
});
