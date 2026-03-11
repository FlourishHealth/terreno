import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";

import {OutOfOfficeIcon} from "./OutOfficeIcon";

describe("OutOfOfficeIcon", () => {
  it("renders correctly", () => {
    const {toJSON} = render(<OutOfOfficeIcon />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with doNotDisturb indicator", () => {
    const {toJSON} = render(<OutOfOfficeIcon doNotDisturb />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("accepts custom props", () => {
    const {toJSON} = render(<OutOfOfficeIcon height={50} width={45} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
