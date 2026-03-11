import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";

import {TableDate} from "./TableDate";

describe("TableDate", () => {
  it("renders correctly with ISO string date", () => {
    const {toJSON} = render(<TableDate value="2024-01-15T12:00:00.000Z" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders correctly with Date object", () => {
    const {toJSON} = render(<TableDate value={new Date("2024-06-20")} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders date in MM/dd/yyyy format by default", () => {
    const {toJSON} = render(<TableDate value="2024-03-25T12:00:00.000Z" />);
    // Use snapshot since exact date depends on timezone
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders annotated date with relative time", () => {
    const {toJSON} = render(<TableDate annotated value="2024-01-01T00:00:00.000Z" />);
    expect(toJSON()).toMatchSnapshot();
  });
});
