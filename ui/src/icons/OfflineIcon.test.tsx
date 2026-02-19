import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";

import {OfflineIcon} from "./OfflineIcon";

describe("OfflineIcon", () => {
  it("renders correctly", () => {
    const {toJSON} = render(<OfflineIcon />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with doNotDisturb indicator", () => {
    const {toJSON} = render(<OfflineIcon doNotDisturb />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("accepts custom props", () => {
    const {toJSON} = render(<OfflineIcon height={50} width={45} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
