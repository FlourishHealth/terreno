import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";

import {OnlineIcon} from "./OnlineIcon";

describe("OnlineIcon", () => {
  it("renders correctly", () => {
    const {toJSON} = render(<OnlineIcon />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with doNotDisturb indicator", () => {
    const {toJSON} = render(<OnlineIcon doNotDisturb />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("accepts custom props", () => {
    const {toJSON} = render(<OnlineIcon height={50} width={45} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
