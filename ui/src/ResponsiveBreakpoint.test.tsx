import {describe, it, mock} from "bun:test";
import {assert} from "chai";
import type React from "react";
import {renderToString} from "react-dom/server";

import {
  createNativeResponsiveBreakpointStore,
  createResponsiveBreakpointStore,
  getBreakpointForWidth,
  isBreakpointAtLeast,
  ResponsiveBreakpointProvider,
  useResponsiveBreakpoint,
} from "./ResponsiveBreakpoint";

const BreakpointConsumer: React.FC = () => {
  const breakpoint = useResponsiveBreakpoint();
  return <span>{breakpoint}</span>;
};

describe("ResponsiveBreakpoint", () => {
  it("keeps exact responsive breakpoint boundaries", () => {
    assert.equal(getBreakpointForWidth(575), "xs");
    assert.equal(getBreakpointForWidth(576), "sm");
    assert.equal(getBreakpointForWidth(767), "sm");
    assert.equal(getBreakpointForWidth(768), "md");
    assert.equal(getBreakpointForWidth(1311), "md");
    assert.equal(getBreakpointForWidth(1312), "lg");
  });

  it("compares breakpoints without reading Dimensions", () => {
    assert.isFalse(isBreakpointAtLeast({breakpoint: "xs", minimum: "sm"}));
    assert.isTrue(isBreakpointAtLeast({breakpoint: "sm", minimum: "sm"}));
    assert.isTrue(isBreakpointAtLeast({breakpoint: "lg", minimum: "md"}));
  });

  it("maps native resize and rotation events into shared breakpoint updates", () => {
    let dimensionListener: ((event: {window: {width: number}}) => void) | undefined;
    const removeListener = mock(() => {});
    const subscriber = mock(() => {});
    const store = createNativeResponsiveBreakpointStore({
      addEventListener: (_eventType, listener) => {
        dimensionListener = listener;
        return {remove: removeListener};
      },
      get: () => ({width: 575}),
    });
    const unsubscribe = store.subscribe(subscriber);

    assert.equal(store.getSnapshot(), "xs");
    dimensionListener?.({window: {width: 768}});
    assert.equal(store.getSnapshot(), "md");
    assert.lengthOf(subscriber.mock.calls, 1);

    unsubscribe();
    assert.lengthOf(removeListener.mock.calls, 1);
  });

  it("uses the xs server snapshot before client hydration", () => {
    const store = createResponsiveBreakpointStore({
      getWindowWidth: () => 1312,
      subscribeToDimensions: () => ({remove: () => {}}),
    });

    const html = renderToString(
      <ResponsiveBreakpointProvider store={store}>
        <BreakpointConsumer />
      </ResponsiveBreakpointProvider>
    );

    assert.include(html, ">xs<");
    assert.equal(store.getSnapshot(), "lg");
  });
});
