import {describe, expect, it} from "bun:test";
import {renderWithTheme} from "../test-utils";
import {PasswordRequirements} from "./PasswordRequirements";
import {defaultPasswordRequirements} from "./passwordPresets";

describe("PasswordRequirements", () => {
  it("renders all requirements", () => {
    const {getByTestId} = renderWithTheme(
      <PasswordRequirements password="" requirements={defaultPasswordRequirements} />
    );
    expect(getByTestId("password-requirements")).toBeTruthy();
    for (const req of defaultPasswordRequirements) {
      expect(getByTestId(`password-requirements-${req.key}`)).toBeTruthy();
    }
  });

  it("renders with custom testID", () => {
    const {getByTestId} = renderWithTheme(
      <PasswordRequirements
        password=""
        requirements={defaultPasswordRequirements}
        testID="custom-reqs"
      />
    );
    expect(getByTestId("custom-reqs")).toBeTruthy();
  });

  it("renders correctly with empty password", () => {
    const {toJSON} = renderWithTheme(
      <PasswordRequirements password="" requirements={defaultPasswordRequirements} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders correctly with a strong password", () => {
    const {toJSON} = renderWithTheme(
      <PasswordRequirements password="MyP@ssw0rd!" requirements={defaultPasswordRequirements} />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
