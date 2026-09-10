import {describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";

import {useAcknowledgeAnnouncement} from "./useAcknowledgeAnnouncement";

type AcknowledgeApi = Parameters<typeof useAcknowledgeAnnouncement>[0];

interface MockMutationDef {
  query: (args: {announcementId: string; platform?: string}) => {
    body?: {platform?: string};
    method: string;
    url: string;
  };
}

interface MockInjectOpts {
  endpoints: (build: {mutation: (def: MockMutationDef) => string}) => Record<string, unknown>;
}

describe("useAcknowledgeAnnouncement", () => {
  const buildApi = () => {
    const acknowledgeUnwrap = mock(async () => ({acknowledged: true}));
    const impressionUnwrap = mock(async () => ({recorded: true}));
    const acknowledgeMutation = mock(() => ({unwrap: acknowledgeUnwrap}));
    const impressionMutation = mock(() => ({unwrap: impressionUnwrap}));
    const api = {
      enhanceEndpoints: mock(() => ({
        injectEndpoints: mock((opts: MockInjectOpts) => {
          const build = {
            mutation: mock((def: MockMutationDef) => {
              const result = def.query({announcementId: "a1", platform: "ios"});
              expect(result.method).toBe("POST");
              expect(result.url).toContain("/announcements/a1/");
              return "mutation";
            }),
          };
          opts.endpoints(build);
          return {
            useAcknowledgeAnnouncementMutation: () => [
              acknowledgeMutation,
              {error: undefined, isLoading: false},
            ],
            useRecordAnnouncementImpressionMutation: () => [
              impressionMutation,
              {error: undefined, isLoading: false},
            ],
          };
        }),
      })),
    };
    return {acknowledgeMutation, api, impressionMutation};
  };

  it("acknowledges and records impressions", async () => {
    const {api, acknowledgeMutation, impressionMutation} = buildApi();
    const {result} = renderHook(() =>
      useAcknowledgeAnnouncement(api as unknown as AcknowledgeApi, "/api")
    );
    await result.current.acknowledge("announcement-1");
    await result.current.recordImpression("announcement-1", "ios");
    expect(acknowledgeMutation).toHaveBeenCalled();
    expect(impressionMutation).toHaveBeenCalled();
  });

  it("defaults impression platform to web", async () => {
    const {api, impressionMutation} = buildApi();
    const {result} = renderHook(() => useAcknowledgeAnnouncement(api as unknown as AcknowledgeApi));
    await result.current.recordImpression("announcement-1");
    expect(impressionMutation).toHaveBeenCalledWith({
      announcementId: "announcement-1",
      platform: "web",
    });
  });
});
