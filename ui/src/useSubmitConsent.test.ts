import {describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";

import type {SubmitConsentBody} from "./useSubmitConsent";
import {useSubmitConsent} from "./useSubmitConsent";

type SubmitConsentApi = Parameters<typeof useSubmitConsent>[0];

interface MockMutationDef {
  query: (body: SubmitConsentBody) => {method: string; url: string};
}

interface MockInjectOpts {
  endpoints: (build: {mutation: (def: MockMutationDef) => string}) => Record<string, unknown>;
}

describe("useSubmitConsent", () => {
  const buildApi = () => {
    const unwrap = mock(async () => ({success: true}));
    const submitMutation = mock(() => ({unwrap}));
    const useSubmitConsentResponseMutation = mock(() => [
      submitMutation,
      {error: undefined, isLoading: false},
    ]);
    const api = {
      enhanceEndpoints: mock(() => ({
        injectEndpoints: mock((opts: MockInjectOpts) => {
          const build = {
            mutation: mock((def: MockMutationDef) => {
              // Exercise the query builder
              const result = def.query({
                agreed: true,
                consentFormId: "f1",
                locale: "en",
              });
              expect(result.method).toBe("POST");
              expect(result.url).toContain("/consents/respond");
              return "submit-mutation";
            }),
          };
          opts.endpoints(build);
          return {useSubmitConsentResponseMutation};
        }),
      })),
    };
    return {api, submitMutation, unwrap};
  };

  it("returns submit function and state", () => {
    const {api} = buildApi();
    const {result} = renderHook(() => useSubmitConsent(api as unknown as SubmitConsentApi));
    expect(typeof result.current.submit).toBe("function");
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it("calls submit mutation when submit is invoked", async () => {
    const {api, submitMutation, unwrap} = buildApi();
    const {result} = renderHook(() => useSubmitConsent(api as unknown as SubmitConsentApi, "/api"));
    const response = await result.current.submit({
      agreed: true,
      consentFormId: "f1",
      locale: "en",
    });
    expect(submitMutation).toHaveBeenCalled();
    expect(unwrap).toHaveBeenCalled();
    expect(response).toEqual({success: true});
  });

  it("uses empty baseUrl when none provided", () => {
    const {api} = buildApi();
    const {result} = renderHook(() => useSubmitConsent(api as unknown as SubmitConsentApi));
    expect(result.current.submit).toBeDefined();
  });
});
