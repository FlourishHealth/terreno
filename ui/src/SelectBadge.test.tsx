import {describe, expect, it} from "bun:test";

import {SelectBadge} from "./SelectBadge";
import {renderWithTheme} from "./test-utils";

describe("SelectBadge", () => {
  const defaultOptions = [
    {label: "Option A", value: "a"},
    {label: "Option B", value: "b"},
    {label: "Option C", value: "c"},
  ];

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(
      <SelectBadge onChange={() => {}} options={defaultOptions} value="a" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("displays selected option label", () => {
    const {getByText} = renderWithTheme(
      <SelectBadge onChange={() => {}} options={defaultOptions} value="b" />
    );
    expect(getByText("Option B")).toBeTruthy();
  });

  it("displays placeholder when no value", () => {
    const {getByText} = renderWithTheme(
      <SelectBadge onChange={() => {}} options={defaultOptions} value={undefined as any} />
    );
    expect(getByText("---")).toBeTruthy();
  });

  it("renders with info status (default)", () => {
    const {toJSON} = renderWithTheme(
      <SelectBadge onChange={() => {}} options={defaultOptions} status="info" value="a" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with success status", () => {
    const {toJSON} = renderWithTheme(
      <SelectBadge onChange={() => {}} options={defaultOptions} status="success" value="a" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with warning status", () => {
    const {toJSON} = renderWithTheme(
      <SelectBadge onChange={() => {}} options={defaultOptions} status="warning" value="a" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with error status", () => {
    const {toJSON} = renderWithTheme(
      <SelectBadge onChange={() => {}} options={defaultOptions} status="error" value="a" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with neutral status", () => {
    const {toJSON} = renderWithTheme(
      <SelectBadge onChange={() => {}} options={defaultOptions} status="neutral" value="a" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with secondary style", () => {
    const {toJSON} = renderWithTheme(
      <SelectBadge
        onChange={() => {}}
        options={defaultOptions}
        secondary
        status="success"
        value="a"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom colors", () => {
    const {toJSON} = renderWithTheme(
      <SelectBadge
        customBackgroundColor="#FF0000"
        customBorderColor="#00FF00"
        customTextColor="#0000FF"
        onChange={() => {}}
        options={defaultOptions}
        status="custom"
        value="a"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(
      <SelectBadge disabled onChange={() => {}} options={defaultOptions} value="a" />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
