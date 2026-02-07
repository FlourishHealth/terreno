import {describe, expect, it} from "bun:test";

import {PasswordField} from "./PasswordField";
import {renderWithTheme} from "./test-utils";

describe("PasswordField", () => {
  it("component is defined", () => {
    expect(PasswordField).toBeDefined();
    expect(typeof PasswordField).toBe("function");
  });

  it("renders correctly", () => {
    // PasswordField is currently a stub that just renders Box
    const {toJSON} = renderWithTheme(<PasswordField />);
    expect(toJSON()).toMatchSnapshot();
  });
});
