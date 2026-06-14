import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {OpenFeatureProvider, useBooleanFlagValue} from "@openfeature/react-sdk";
import {NOOP_PROVIDER, OpenFeature, TypedInMemoryProvider} from "@openfeature/web-sdk";
import {renderHook, waitFor} from "@testing-library/react-native";
import React from "react";

const SPIKE_DOMAIN = "openfeature-rn-spike";

describe("@openfeature/react-sdk with React Native test renderer", () => {
  beforeEach(async () => {
    await OpenFeature.setProviderAndWait(
      SPIKE_DOMAIN,
      new TypedInMemoryProvider({
        "demo-flag": {
          defaultVariant: "on",
          disabled: false,
          variants: {off: false, on: true},
        },
      })
    );
  });

  afterEach(async () => {
    await OpenFeature.setProviderAndWait(SPIKE_DOMAIN, NOOP_PROVIDER);
  });

  it("exposes useBooleanFlagValue when wrapped by OpenFeatureProvider", async () => {
    const {result} = renderHook(() => useBooleanFlagValue("demo-flag", false), {
      wrapper: ({children}: {children: React.ReactNode}) =>
        React.createElement(OpenFeatureProvider, {domain: SPIKE_DOMAIN}, children),
    });
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});
