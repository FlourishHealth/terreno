import {afterEach, describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";
import {DateTime, Settings} from "luxon";

import {TableDate} from "./TableDate";

describe("TableDate", () => {
  const freezeNow = (iso: string): void => {
    const millis = DateTime.fromISO(iso).toMillis();
    Settings.now = () => millis;
  };

  afterEach(() => {
    Settings.now = () => Date.now();
  });

  it("pluralizes years, months, and days in the annotation", () => {
    freezeNow("2024-06-20T12:00:00.000Z");
    const {getByText} = render(<TableDate annotated value="2022-03-15T12:00:00.000Z" />);
    expect(getByText("03/15/2022 (2 Years 3 Mos 5 Days)")).toBeTruthy();
  });

  it("uses singular labels for exactly one year, month, and day", () => {
    freezeNow("2024-06-20T12:00:00.000Z");
    const {getByText} = render(<TableDate annotated value="2023-05-19T12:00:00.000Z" />);
    expect(getByText("05/19/2023 (1 Year 1 Mo 1 Day)")).toBeTruthy();
  });

  it("omits zero units from the annotation", () => {
    freezeNow("2024-06-20T12:00:00.000Z");
    const {getByText} = render(<TableDate annotated value="2024-06-10T12:00:00.000Z" />);
    expect(getByText("06/10/2024 (10 Days)")).toBeTruthy();
  });

  it("renders an empty annotation for today's date", () => {
    freezeNow("2024-06-20T12:00:00.000Z");
    const {getByText} = render(<TableDate annotated value="2024-06-20T12:00:00.000Z" />);
    expect(getByText("06/20/2024 ()")).toBeTruthy();
  });

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
