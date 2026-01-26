import type {Mock} from "bun:test";
import {describe, expect, it, mock} from "bun:test";

import {Field} from "./Field";
import {renderWithTheme} from "./test-utils";

describe("Field", () => {
  it("renders text field by default", () => {
    const {toJSON} = renderWithTheme(<Field label="Name" onChange={() => {}} value="" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders text field with type text", () => {
    const {toJSON} = renderWithTheme(
      <Field label="Name" onChange={() => {}} type="text" value="" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders password field", () => {
    const {toJSON} = renderWithTheme(
      <Field label="Password" onChange={() => {}} type="password" value="" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders email field", () => {
    const {toJSON} = renderWithTheme(
      <Field label="Email" onChange={() => {}} type="email" value="" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders url field", () => {
    const {toJSON} = renderWithTheme(
      <Field label="Website" onChange={() => {}} type="url" value="" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders number field", () => {
    const {toJSON} = renderWithTheme(
      <Field label="Age" onChange={() => {}} type="number" value="" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders textarea field", () => {
    const {toJSON} = renderWithTheme(
      <Field label="Description" onChange={() => {}} type="textarea" value="" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders boolean field", () => {
    const handleChange = mock((value: boolean) => {});
    const {toJSON} = renderWithTheme(
      <Field label="Active" onChange={handleChange} type="boolean" value={false} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders date field", () => {
    const {toJSON} = renderWithTheme(
      <Field label="Birth Date" onChange={() => {}} type="date" value={null} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders time field", () => {
    const {toJSON} = renderWithTheme(
      <Field label="Start Time" onChange={() => {}} type="time" value={null} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders datetime field", () => {
    const {toJSON} = renderWithTheme(
      <Field label="Appointment" onChange={() => {}} type="datetime" value={null} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders select field", () => {
    const {toJSON} = renderWithTheme(
      <Field
        label="Country"
        onChange={() => {}}
        options={[
          {label: "USA", value: "us"},
          {label: "Canada", value: "ca"},
        ]}
        type="select"
        value=""
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders multiselect field", () => {
    const {toJSON} = renderWithTheme(
      <Field
        label="Skills"
        onChange={() => {}}
        options={[
          {label: "JavaScript", value: "js"},
          {label: "Python", value: "py"},
        ]}
        type="multiselect"
        value={[]}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders address field", () => {
    const {toJSON} = renderWithTheme(
      <Field label="Address" onChange={() => {}} type="address" value="" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders phoneNumber field", () => {
    const {toJSON} = renderWithTheme(
      <Field label="Phone" onChange={() => {}} type="phoneNumber" value="" />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
