import {describe, expect, it} from "bun:test";

import {FilterChangesBadge} from "./FilterChangesBadge";
import {renderWithTheme} from "./test-utils";

describe("FilterChangesBadge", () => {
  it("renders correctly", () => {
    const {toJSON} = renderWithTheme(<FilterChangesBadge />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with the primary surface color and dot dimensions", () => {
    const {getByTestId} = renderWithTheme(<FilterChangesBadge testID="badge" />);
    expect(getByTestId("badge")).toHaveStyle({height: 8, width: 8});
  });
});
