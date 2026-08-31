import {describe, it, mock} from "bun:test";
import {render, waitFor} from "@testing-library/react-native";
import {assert} from "chai";
import type {ComponentType} from "react";

import {ErrorBoundary} from "../ErrorBoundary";
import {createLazyComponentExport, createLazyNamedExport} from "./createLazyComponentExport";

const TestLazyComponent = () => null;

const expectLazyRenderError = async ({
  LazyExport,
  message,
}: {
  LazyExport: ComponentType<Record<string, unknown>>;
  message: string;
}): Promise<void> => {
  const onError = mock((_error: Error) => {});
  const previousError = console.error;
  const previousWarn = console.warn;
  console.error = () => undefined;
  console.warn = () => undefined;

  try {
    const {unmount} = render(
      <ErrorBoundary onError={onError}>
        <LazyExport />
      </ErrorBoundary>
    );
    await waitFor(() => {
      assert.isNotEmpty(onError.mock.calls);
    });
    assert.strictEqual(onError.mock.calls[0]?.[0]?.message, message);
    unmount();
  } finally {
    console.error = previousError;
    console.warn = previousWarn;
  }
};

describe("createLazyComponentExport", () => {
  it("defers module evaluation until render", async () => {
    let loadCount = 0;
    const LazyExport = createLazyComponentExport(async () => {
      loadCount += 1;
      return {default: TestLazyComponent};
    });

    assert.strictEqual(loadCount, 0);
    render(<LazyExport />);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    assert.strictEqual(loadCount, 1);
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

    assert.strictEqual(loadCount, 0);
    assert.strictEqual(
      (LazyExport as unknown as {defaultProps?: {placeholder?: string}}).defaultProps?.placeholder,
      "Search..."
    );
  });

  it("loads named exports through createLazyNamedExport", async () => {
    let loadCount = 0;
    const LazyExport = createLazyNamedExport(async () => {
      loadCount += 1;
      return {NamedWidget: TestLazyComponent};
    }, "NamedWidget");

    assert.strictEqual(loadCount, 0);
    render(<LazyExport />);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    assert.strictEqual(loadCount, 1);
  });

  it("rejects factories without a default component", async () => {
    const LazyExport = createLazyComponentExport(async () => ({notAComponent: true}));
    await expectLazyRenderError({
      LazyExport,
      message: "Lazy component factory must resolve to { default: Component }",
    });
  });

  it("rejects missing named exports", async () => {
    const LazyExport = createLazyNamedExport(async () => ({Other: TestLazyComponent}), "Missing");
    await expectLazyRenderError({
      LazyExport,
      message: 'Lazy export "Missing" was not found',
    });
  });
});
