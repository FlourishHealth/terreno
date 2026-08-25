import {createContext, type FC, type ReactNode, useContext, useSyncExternalStore} from "react";
import {Dimensions} from "react-native";

export type ResponsiveBreakpoint = "xs" | "sm" | "md" | "lg";

interface UseResponsiveBreakpointOptions {
  enabled?: boolean;
}

interface CreateResponsiveBreakpointStoreOptions {
  getWindowWidth: () => number;
  subscribeToDimensions: (listener: (width: number) => void) => {remove: () => void};
}

interface ResponsiveDimensionsSource {
  addEventListener: (
    eventType: "change",
    listener: (event: {window: {width: number}}) => void
  ) => {remove: () => void};
  get: (dimension: "window") => {width: number};
}

export interface ResponsiveBreakpointStore {
  getServerSnapshot: () => ResponsiveBreakpoint;
  getSnapshot: () => ResponsiveBreakpoint;
  subscribe: (subscriber: () => void) => () => void;
  updateWidth: (width: number) => void;
}

interface ResponsiveBreakpointProviderProps {
  children: ReactNode;
  store: ResponsiveBreakpointStore;
}

const BREAKPOINT_ORDER: Record<ResponsiveBreakpoint, number> = {
  lg: 3,
  md: 2,
  sm: 1,
  xs: 0,
};

export const getBreakpointForWidth = (width: number): ResponsiveBreakpoint => {
  if (width < 576) {
    return "xs";
  }
  if (width < 768) {
    return "sm";
  }
  if (width < 1312) {
    return "md";
  }
  return "lg";
};

const getServerBreakpointSnapshot = (): ResponsiveBreakpoint => {
  return "xs";
};

export const createResponsiveBreakpointStore = ({
  getWindowWidth,
  subscribeToDimensions,
}: CreateResponsiveBreakpointStoreOptions): ResponsiveBreakpointStore => {
  const subscribers = new Set<() => void>();
  let currentWindowWidth = getWindowWidth();
  let dimensionSubscription: {remove: () => void} | undefined;

  const updateWidth = (width: number): void => {
    if (width === currentWindowWidth) {
      return;
    }
    currentWindowWidth = width;
    for (const notifySubscriber of subscribers) {
      notifySubscriber();
    }
  };

  const subscribe = (subscriber: () => void): (() => void) => {
    subscribers.add(subscriber);

    if (!dimensionSubscription) {
      currentWindowWidth = getWindowWidth();
      dimensionSubscription = subscribeToDimensions(updateWidth);
    }

    return (): void => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        dimensionSubscription?.remove();
        dimensionSubscription = undefined;
      }
    };
  };

  return {
    getServerSnapshot: getServerBreakpointSnapshot,
    getSnapshot: (): ResponsiveBreakpoint => getBreakpointForWidth(currentWindowWidth),
    subscribe,
    updateWidth,
  };
};

export const createNativeResponsiveBreakpointStore = (
  dimensions: ResponsiveDimensionsSource
): ResponsiveBreakpointStore => {
  return createResponsiveBreakpointStore({
    getWindowWidth: (): number => dimensions.get("window").width,
    subscribeToDimensions: (listener) =>
      dimensions.addEventListener("change", ({window}): void => {
        listener(window.width);
      }),
  });
};

const defaultBreakpointStore = createNativeResponsiveBreakpointStore(Dimensions);

const ResponsiveBreakpointContext =
  createContext<ResponsiveBreakpointStore>(defaultBreakpointStore);

export const ResponsiveBreakpointProvider: FC<ResponsiveBreakpointProviderProps> = ({
  children,
  store,
}) => {
  return (
    <ResponsiveBreakpointContext.Provider value={store}>
      {children}
    </ResponsiveBreakpointContext.Provider>
  );
};

const subscribeToNothing = (): (() => void) => {
  return (): void => {};
};

export const useResponsiveBreakpoint = ({
  enabled = true,
}: UseResponsiveBreakpointOptions = {}): ResponsiveBreakpoint => {
  const store = useContext(ResponsiveBreakpointContext);
  return useSyncExternalStore(
    enabled ? store.subscribe : subscribeToNothing,
    store.getSnapshot,
    store.getServerSnapshot
  );
};

export const isBreakpointAtLeast = ({
  breakpoint,
  minimum,
}: {
  breakpoint: ResponsiveBreakpoint;
  minimum: ResponsiveBreakpoint;
}): boolean => {
  return BREAKPOINT_ORDER[breakpoint] >= BREAKPOINT_ORDER[minimum];
};
