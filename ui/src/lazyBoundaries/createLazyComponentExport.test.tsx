import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";

import {createLazyComponentExport, createLazyNamedExport} from "./createLazyComponentExport";

const TestLazyComponent = () => null;

describe("createLazyComponentExport", () => {
  it("defers module evaluation until render", async () => {
    let loadCount = 0;
    const LazyExport = createLazyComponentExport(async () => {
      loadCount += 1;
      return {default: TestLazyComponent};
    });

    expect(loadCount).toBe(0);
    render(<LazyExport />);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(loadCount).toBe(1);
  });

  it("does not invoke factory when staticProperties are provided", () => {
    let loadCount = 0;
    const LazyExport = createLazyComponentExport(
      async () => {
        loadCount += 1;
        return {default: TestLazyComponent};
      },
      {defaultProps: {placeholder: "Search..."}}
    );

    expect(loadCount).toBe(0);
    expect(
      (LazyExport as unknown as {defaultProps?: {placeholder?: string}}).defaultProps?.placeholder
    ).toBe("Search...");
  });

  it("loads named exports through createLazyNamedExport", async () => {
    let loadCount = 0;
    const LazyExport = createLazyNamedExport(async () => {
      loadCount += 1;
      return {NamedWidget: TestLazyComponent};
    }, "NamedWidget");

    expect(loadCount).toBe(0);
    render(<LazyExport />);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(loadCount).toBe(1);
  });
});
