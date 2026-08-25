import {describe, it, mock} from "bun:test";
import {render} from "@testing-library/react-native";
import {assert} from "chai";
import type React from "react";
import {renderToString} from "react-dom/server";
import {View} from "react-native";

import {
  createNativeResponsiveBreakpointStore,
  createResponsiveBreakpointStore,
  getBreakpointForWidth,
  isBreakpointAtLeast,
  type ResponsiveBreakpointStore,
  useResponsiveBreakpoint,
} from "./ResponsiveBreakpoint";

interface BreakpointConsumerProps {
  enabled?: boolean;
  store: ResponsiveBreakpointStore;
}

const BreakpointConsumer: React.FC<BreakpointConsumerProps> = ({
  enabled = true,
  store,
}): React.ReactElement => {
  const breakpoint = useResponsiveBreakpoint({enabled, store});
  return <span>{breakpoint}</span>;
};

const BreakpointSubscriber: React.FC<BreakpointConsumerProps> = ({enabled = true, store}): null => {
  useResponsiveBreakpoint({enabled, store});
  return null;
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
    const removeListener = mock((): void => {});
    const subscriber = mock((): void => {});
    const store = createNativeResponsiveBreakpointStore({
      addEventListener: (_eventType, listener): {remove: () => void} => {
        dimensionListener = listener;
        return {remove: removeListener};
      },
      get: (): {width: number} => ({width: 575}),
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
      getWindowWidth: (): number => 1312,
      subscribeToDimensions: (): {remove: () => void} => ({remove: (): void => {}}),
    });

    const html = renderToString(<BreakpointConsumer store={store} />);

    assert.include(html, ">xs<");
    assert.equal(store.getSnapshot(), "lg");
  });

  it("shares one dimensions listener across a responsive tree", () => {
    let dimensionReadCount = 0;
    let listenerCount = 0;
    let removeCount = 0;
    const store = createResponsiveBreakpointStore({
      getWindowWidth: (): number => {
        dimensionReadCount += 1;
        return 768;
      },
      subscribeToDimensions: (): {remove: () => void} => {
        listenerCount += 1;
        return {
          remove: (): void => {
            removeCount += 1;
          },
        };
      },
    });
    const result = render(
      <View>
        {Array.from(
          {length: 100},
          (_, index): React.ReactElement => (
            <BreakpointSubscriber key={index} store={store} />
          )
        )}
      </View>
    );

    assert.equal(dimensionReadCount, 2);
    assert.equal(listenerCount, 1);

    result.unmount();
    assert.equal(removeCount, 1);
  });

  it("does not subscribe when responsive behavior is disabled", () => {
    let listenerCount = 0;
    const store = createResponsiveBreakpointStore({
      getWindowWidth: (): number => 768,
      subscribeToDimensions: (): {remove: () => void} => {
        listenerCount += 1;
        return {remove: (): void => {}};
      },
    });
    const result = render(
      <View>
        {Array.from(
          {length: 100},
          (_, index): React.ReactElement => (
            <BreakpointSubscriber enabled={false} key={index} store={store} />
          )
        )}
      </View>
    );

    assert.equal(listenerCount, 0);
    result.unmount();
  });
});
