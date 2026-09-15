import {describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";
import {assert} from "chai";
import {Platform} from "react-native";

import {useAcknowledgeAnnouncement} from "./useAcknowledgeAnnouncement";

type AcknowledgeApi = Parameters<typeof useAcknowledgeAnnouncement>[0];

interface MockMutationDef {
  query: (args: {announcementId: string; platform?: string}) => {
    body?: {action?: string; platform?: string};
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
    const clickUnwrap = mock(async () => ({recorded: true}));
    const acknowledgeMutation = mock(() => ({unwrap: acknowledgeUnwrap}));
    const impressionMutation = mock(() => ({unwrap: impressionUnwrap}));
    const clickMutation = mock(() => ({unwrap: clickUnwrap}));
    let clickQueryDef: MockMutationDef | undefined;
    const api = {
      enhanceEndpoints: mock(() => ({
        injectEndpoints: mock((opts: MockInjectOpts) => {
          const build = {
            mutation: mock((def: MockMutationDef) => {
              const result = def.query({announcementId: "a1", platform: "ios"});
              expect(result.method).toBe("POST");
              expect(result.url).toContain("/announcements/a1/");
              if (result.url.includes("/click")) {
                clickQueryDef = def;
              }
              return "mutation";
            }),
          };
          opts.endpoints(build);
          return {
            useAcknowledgeAnnouncementMutation: () => [
              acknowledgeMutation,
              {error: undefined, isLoading: false},
            ],
            useRecordAnnouncementClickMutation: () => [
              clickMutation,
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
    return {
      acknowledgeMutation,
      api,
      clickMutation,
      clickQueryDef: () => clickQueryDef,
      impressionMutation,
    };
  };

  it("acknowledges and records impressions", async () => {
    const {api, acknowledgeMutation, impressionMutation} = buildApi();
    const {result} = renderHook(() =>
      useAcknowledgeAnnouncement(api as unknown as AcknowledgeApi, "/api")
    );
    await result.current.acknowledge("announcement-1");
    await result.current.recordImpression("announcement-1");
    expect(acknowledgeMutation).toHaveBeenCalled();
    expect(impressionMutation).toHaveBeenCalled();
  });

  it("uses the client platform for impressions", async () => {
    const originalOS = Platform.OS;
    Platform.OS = "ios";
    const {api, impressionMutation} = buildApi();
    const {result} = renderHook(() => useAcknowledgeAnnouncement(api as unknown as AcknowledgeApi));
    await result.current.recordImpression("announcement-1");
    expect(impressionMutation).toHaveBeenCalledWith({
      announcementId: "announcement-1",
      platform: "ios",
    });
    Platform.OS = originalOS;
  });

  it("records primary-action clicks with platform and build version in the query", async () => {
    const constantsState = {
      expoConfig: {
        extra: {
          buildNumber: 42,
        },
      },
    };
    mock.module("expo-constants", () => ({
      default: constantsState,
    }));

    const originalOS = Platform.OS;
    Platform.OS = "web";

    const {api, clickMutation, clickQueryDef} = buildApi();
    const {result} = renderHook(() =>
      useAcknowledgeAnnouncement(api as unknown as AcknowledgeApi, "/api")
    );

    await result.current.recordClick("announcement-42");

    assert.strictEqual(clickMutation.mock.calls.length, 1);
    assert.deepEqual(clickMutation.mock.calls[0], [{announcementId: "announcement-42"}]);

    const clickDef = clickQueryDef();
    assert.ok(clickDef);
    const queryResult = clickDef.query({announcementId: "announcement-42"});
    assert.strictEqual(queryResult.method, "POST");
    assert.strictEqual(queryResult.url, "/api/announcements/announcement-42/click?version=42");
    assert.deepEqual(queryResult.body, {action: "primaryAction", platform: "web"});

    Platform.OS = originalOS;
    mock.module("expo-constants", () => ({
      default: {expoConfig: {extra: {buildNumber: undefined}}},
    }));
  });

  it("omits version from click URL when build number is not finite", async () => {
    mock.module("expo-constants", () => ({
      default: {expoConfig: {extra: {buildNumber: undefined}}},
    }));

    const originalOS = Platform.OS;
    Platform.OS = "android";

    const {api, clickQueryDef} = buildApi();
    renderHook(() => useAcknowledgeAnnouncement(api as unknown as AcknowledgeApi, "/api"));

    const clickDef = clickQueryDef();
    assert.ok(clickDef);
    const queryResult = clickDef.query({announcementId: "announcement-1"});
    assert.strictEqual(queryResult.url, "/api/announcements/announcement-1/click");
    assert.deepEqual(queryResult.body, {action: "primaryAction", platform: "android"});

    Platform.OS = originalOS;
  });
});
