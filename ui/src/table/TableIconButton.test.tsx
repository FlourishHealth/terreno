import {describe, expect, it} from "bun:test";
import {renderWithTheme} from "../test-utils";
import {TableIconButton} from "./TableIconButton";

describe("TableIconButton", () => {
  it("renders edit button correctly", () => {
    const {toJSON} = renderWithTheme(
      <TableIconButton onClick={() => {}} tableIconButtonName="edit" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders drawer open button correctly", () => {
    const {toJSON} = renderWithTheme(
      <TableIconButton onClick={() => {}} tableIconButtonName="drawerOpen" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders drawer close button correctly", () => {
    const {toJSON} = renderWithTheme(
      <TableIconButton onClick={() => {}} tableIconButtonName="drawerClose" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders insert button correctly", () => {
    const {toJSON} = renderWithTheme(
      <TableIconButton onClick={() => {}} tableIconButtonName="insert" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders save and close button correctly", () => {
    const {toJSON} = renderWithTheme(
      <TableIconButton onClick={() => {}} tableIconButtonName="saveAndClose" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders all button types correctly", () => {
    // Test that all button types render without errors
    const types = ["edit", "drawerOpen", "drawerClose", "insert", "saveAndClose"] as const;
    types.forEach((type) => {
      const {toJSON} = renderWithTheme(
        <TableIconButton onClick={() => {}} tableIconButtonName={type} />
      );
      expect(toJSON()).toBeTruthy();
    });
  });
});
