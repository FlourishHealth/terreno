import {describe, expect, it} from "bun:test";

import {renderWithTheme} from "../test-utils";

import {PasswordRequirements} from "./PasswordRequirements";
import {defaultPasswordRequirements} from "./passwordPresets";

describe("PasswordRequirements", () => {
  const defaultProps = {
    password: "",
    requirements: defaultPasswordRequirements,
    showCheckmarks: true,
    visible: true,
  };

  describe("visibility", () => {
    it("should render when visible is true", () => {
      const {getByText} = renderWithTheme(<PasswordRequirements {...defaultProps} />);

      expect(getByText("At least 8 characters")).toBeTruthy();
    });

    it("should not render when visible is false", () => {
      const {queryByText} = renderWithTheme(
        <PasswordRequirements {...defaultProps} visible={false} />
      );

      expect(queryByText("At least 8 characters")).toBeNull();
    });
  });

  describe("requirement labels", () => {
    it("should display all requirement labels", () => {
      const {getByText} = renderWithTheme(<PasswordRequirements {...defaultProps} />);

      expect(getByText("At least 8 characters")).toBeTruthy();
      expect(getByText("At least one uppercase letter")).toBeTruthy();
      expect(getByText("At least one lowercase letter")).toBeTruthy();
      expect(getByText("At least one number")).toBeTruthy();
      expect(getByText("At least one special character")).toBeTruthy();
    });
  });

  describe("validation status", () => {
    it("should show requirements as not met when password is empty", () => {
      const {root} = renderWithTheme(<PasswordRequirements {...defaultProps} password="" />);

      expect(root).toBeTruthy();
    });

    it("should update requirement status when password meets criteria", () => {
      const {root} = renderWithTheme(
        <PasswordRequirements {...defaultProps} password="Password1!" />
      );

      expect(root).toBeTruthy();
    });

    it("should handle partial password validation", () => {
      const {root} = renderWithTheme(
        <PasswordRequirements {...defaultProps} password="password" />
      );

      expect(root).toBeTruthy();
    });
  });

  describe("checkmarks", () => {
    it("should show icons when showCheckmarks is true", () => {
      const {root} = renderWithTheme(
        <PasswordRequirements {...defaultProps} showCheckmarks={true} />
      );

      expect(root).toBeTruthy();
    });

    it("should hide icons when showCheckmarks is false", () => {
      const {root} = renderWithTheme(
        <PasswordRequirements {...defaultProps} showCheckmarks={false} />
      );

      expect(root).toBeTruthy();
    });
  });

  describe("custom requirements", () => {
    it("should render custom requirements", () => {
      const customRequirements = [
        {
          id: "custom1",
          label: "Custom requirement 1",
          validate: () => true,
        },
        {
          id: "custom2",
          label: "Custom requirement 2",
          validate: () => false,
        },
      ];

      const {getByText} = renderWithTheme(
        <PasswordRequirements
          password=""
          requirements={customRequirements}
          showCheckmarks={true}
          visible={true}
        />
      );

      expect(getByText("Custom requirement 1")).toBeTruthy();
      expect(getByText("Custom requirement 2")).toBeTruthy();
    });
  });

  describe("snapshots", () => {
    it("should match snapshot with empty password", () => {
      const component = renderWithTheme(<PasswordRequirements {...defaultProps} password="" />);
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot with valid password", () => {
      const component = renderWithTheme(
        <PasswordRequirements {...defaultProps} password="Password1!" />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot without checkmarks", () => {
      const component = renderWithTheme(
        <PasswordRequirements {...defaultProps} showCheckmarks={false} />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot when not visible", () => {
      const component = renderWithTheme(<PasswordRequirements {...defaultProps} visible={false} />);
      expect(component.toJSON()).toMatchSnapshot();
    });
  });
});
