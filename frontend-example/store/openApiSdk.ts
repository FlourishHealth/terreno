import {emptySplitApi as api} from "@terreno/rtk";
export const addTagTypes = [] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (_build) => ({}),
    overrideExisting: false,
  });
export {injectedRtkApi as openapi};
