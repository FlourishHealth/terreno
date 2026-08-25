import {useSyncExternalStore} from "react";
import {Dimensions} from "react-native";

export type ResponsiveBreakpoint = "xs" | "sm" | "md" | "lg";

interface UseResponsiveBreakpointOptions {
  enabled?: boolean;
}

const BREAKPOINT_ORDER: Record<ResponsiveBreakpoint, number> = {
  lg: 3,
  md: 2,
  sm: 1,
  xs: 0,
};

const subscribers = new Set<() => void>();
let currentWindowWidth = Dimensions.get("window").width;
let dimensionSubscription: {remove: () => void} | undefined;

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

const getBreakpointSnapshot = (): ResponsiveBreakpoint => {
  return getBreakpointForWidth(currentWindowWidth);
};

const getServerBreakpointSnapshot = (): ResponsiveBreakpoint => {
  return "xs";
};

const subscribeToBreakpoint = (subscriber: () => void): (() => void) => {
  subscribers.add(subscriber);

  if (!dimensionSubscription) {
    currentWindowWidth = Dimensions.get("window").width;
    dimensionSubscription = Dimensions.addEventListener("change", ({window}): void => {
      if (window.width === currentWindowWidth) {
        return;
      }
      currentWindowWidth = window.width;
      for (const notifySubscriber of subscribers) {
        notifySubscriber();
      }
    });
  }

  return (): void => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      dimensionSubscription?.remove();
      dimensionSubscription = undefined;
    }
  };
};

const subscribeToNothing = (): (() => void) => {
  return (): void => {};
};

export const useResponsiveBreakpoint = ({
  enabled = true,
}: UseResponsiveBreakpointOptions = {}): ResponsiveBreakpoint => {
  return useSyncExternalStore(
    enabled ? subscribeToBreakpoint : subscribeToNothing,
    getBreakpointSnapshot,
    getServerBreakpointSnapshot
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
