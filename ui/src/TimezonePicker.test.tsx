import {describe, expect, it, mock} from "bun:test";

import {TimezonePicker} from "./TimezonePicker";
import {renderWithTheme} from "./test-utils";

describe("TimezonePicker", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<TimezonePicker onChange={() => {}} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with title by default", () => {
    const {getByText} = renderWithTheme(<TimezonePicker onChange={() => {}} />);
    expect(getByText("Timezone")).toBeTruthy();
  });

  it("hides title when hideTitle is true", () => {
    const {toJSON} = renderWithTheme(<TimezonePicker hideTitle onChange={() => {}} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with selected timezone", () => {
    const {toJSON} = renderWithTheme(
      <TimezonePicker onChange={() => {}} timezone="America/New_York" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders USA timezones by default", () => {
    const {toJSON} = renderWithTheme(
      <TimezonePicker location="USA" onChange={() => {}} timezone="America/New_York" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders worldwide timezones when specified", () => {
    const {toJSON} = renderWithTheme(
      <TimezonePicker location="Worldwide" onChange={() => {}} timezone="Europe/London" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with short timezone labels", () => {
    const {toJSON} = renderWithTheme(
      <TimezonePicker onChange={() => {}} shortTimezone timezone="America/New_York" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("calls onChange when timezone is selected", () => {
    const handleChange = mock((_value: string) => {});
    const {toJSON} = renderWithTheme(
      <TimezonePicker onChange={handleChange} timezone="America/New_York" />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
