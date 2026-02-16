import {describe, expect, it} from "bun:test";

import {SectionDivider} from "./SectionDivider";
import {renderWithTheme} from "./test-utils";

describe("SectionDivider", () => {
  it("renders correctly", () => {
    const {toJSON} = renderWithTheme(<SectionDivider />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("is hidden from accessibility", () => {
    const {toJSON} = renderWithTheme(<SectionDivider />);
    // The component should have aria-hidden=true
    expect(toJSON()).toMatchSnapshot();
  });
});
