import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";

import {MobileIcon} from "./MobileIcon";

describe("MobileIcon", () => {
  it("renders correctly", () => {
    const {toJSON} = render(<MobileIcon />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with doNotDisturb indicator", () => {
    const {toJSON} = render(<MobileIcon doNotDisturb />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("accepts custom props", () => {
    const {toJSON} = render(<MobileIcon height={50} width={45} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
