import * as Sentry from "@sentry/react";
import {Platform} from "react-native";

const IsWeb = Platform.OS === "web";

export const captureException = (error: unknown | Error): void => {
  if (!IsWeb) {
    return;
  }
  if (Sentry.isInitialized()) {
    Sentry.captureException(error);
  } else {
    console.error("Sentry not initialized, captured exception", error);
  }
};

export const createSentryReduxEnhancer = (): unknown => {
  if (IsWeb && typeof Sentry.createReduxEnhancer === "function") {
    return Sentry.createReduxEnhancer();
  }

  return (next: unknown) => next;
};
