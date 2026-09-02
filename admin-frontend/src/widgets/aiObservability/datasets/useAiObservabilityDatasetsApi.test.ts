import {describe, it} from "bun:test";
import {assert} from "chai";
import type {AdminApi} from "../../../types";
import {createDatasetsApi} from "./useAiObservabilityDatasetsApi";

describe("createDatasetsApi", () => {
  it("registers both dataset cache tag types before injecting endpoints", () => {
    let registeredTags: string[] = [];
    const enhancedApi = {
      injectEndpoints: (): Record<string, never> => {
        return {};
      },
    };
    const api = {
      enhanceEndpoints: (options: {addTagTypes: string[]}): typeof enhancedApi => {
        registeredTags = options.addTagTypes;
        return enhancedApi;
      },
    } as unknown as AdminApi;

    createDatasetsApi(api);

    assert.sameMembers(registeredTags, ["aiObservabilityDatasets", "aiObservabilityDatasetItems"]);
  });
});
