import {describe, expect, it} from "bun:test";
import {act} from "@testing-library/react-native";

import {Spinner} from "./Spinner";
import {renderWithTheme} from "./test-utils";

describe("Spinner", () => {
  it("does not render immediately due to delay", () => {
    const {toJSON} = renderWithTheme(<Spinner />);
    // Spinner has a 300ms delay before showing
    expect(toJSON()).toBeNull();
  });

  it("renders after delay", async () => {
    const {toJSON} = renderWithTheme(<Spinner />);

    // Wait for the 300ms delay
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with small size", async () => {
    const {toJSON} = renderWithTheme(<Spinner size="sm" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with large size", async () => {
    const {toJSON} = renderWithTheme(<Spinner size="md" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with dark color", async () => {
    const {toJSON} = renderWithTheme(<Spinner color="dark" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with accent color", async () => {
    const {toJSON} = renderWithTheme(<Spinner color="accent" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with secondary color", async () => {
    const {toJSON} = renderWithTheme(<Spinner color="secondary" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(toJSON()).toMatchSnapshot();
  });
});
