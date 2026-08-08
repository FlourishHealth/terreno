import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";

import {SparklesIcon} from "./SparklesIcon";

describe("SparklesIcon", () => {
  it("renders correctly", () => {
    const {toJSON} = render(<SparklesIcon />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("accepts custom props", () => {
    const {toJSON} = render(<SparklesIcon fill="#0A0A0A" height={24} width={24} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
