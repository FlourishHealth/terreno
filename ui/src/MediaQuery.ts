import {Dimensions} from "react-native";

import {
  getBreakpointForWidth,
  isBreakpointAtLeast,
  type ResponsiveBreakpoint,
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
  if (size === "lg") {
    return true;
  }
  if (size === "md") {
    return ["xs", "sm", "md"].includes(media);
  }
  if (size === "sm") {
    return ["xs", "sm"].includes(media);
  }
  return media === "xs";
};

export const isMobileDevice = (): boolean => {
  return !mediaQueryLargerThan("sm");
};
