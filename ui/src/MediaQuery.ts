import {Dimensions} from "react-native";

import {
  getBreakpointForWidth,
  getBreakpointSurface,
  isBreakpointAtLeast,
  isSupportedDesktopViewport,
  type ResponsiveBreakpoint,
} from "./ResponsiveBreakpoint";

export {
  type BreakpointSurface,
  getBreakpointForWidth,
  getBreakpointMinWidths,
  getBreakpointSurface,
  isBreakpointAtLeast,
  isSupportedDesktopViewport,
  NATIVE_BREAKPOINT_MIN_WIDTH,
  type ResponsiveBreakpoint,
  WEB_BREAKPOINT_MIN_WIDTH,
} from "./ResponsiveBreakpoint";

export const mediaQuery = (): ResponsiveBreakpoint => {
  return getBreakpointForWidth(Dimensions.get("window").width);
};

export const mediaQueryLargerThan = (size: ResponsiveBreakpoint): boolean => {
  const media = mediaQuery();
  return isBreakpointAtLeast({breakpoint: media, minimum: size});
};

export const mediaQuerySmallerThan = (size: ResponsiveBreakpoint): boolean => {
  const media = mediaQuery();
  return !isBreakpointAtLeast({breakpoint: media, minimum: size}) || media === size;
};

export const isMobileDevice = (): boolean => {
  return !isSupportedDesktopViewport({
    breakpoint: mediaQuery(),
    surface: getBreakpointSurface(),
  });
};
