import {afterEach, describe, expect, it, mock} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";

import {createSessionApi} from "./sessionApi";

type FetchArgs = Parameters<typeof fetch>;

interface RecordedFetch {
  urls: string[];
  handler: (input: FetchArgs[0], init: FetchArgs[1]) => Response;
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    headers: {"Content-Type": "application/json"},
    status,
  });

const originalFetch = global.fetch;
let recorded: RecordedFetch;

const setFetch = (handler: RecordedFetch["handler"]): void => {
  recorded = {handler, urls: []};
  global.fetch = mock((input: FetchArgs[0], init: FetchArgs[1]) => {
    const url =
      typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    recorded.urls.push(url);
    return Promise.resolve(handler(input, init));
  }) as unknown as typeof fetch;
};

const buildStore = () => {
  const api = createSessionApi({baseUrl: "http://localhost:9999"});
  const withEndpoints = api.injectEndpoints({
    endpoints: (build) => ({
      getThing: build.query<unknown, void>({query: () => "/thing"}),
      getWithParams: build.query<unknown, void>({
        query: () => ({params: {ids: {$in: [1, 2]}, status: "active"}, url: "/things"}),
      }),
    }),
    overrideExisting: true,
  });
  const store = configureStore({
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
    reducer: {[api.reducerPath]: api.reducer},
  });
  return {api, store, withEndpoints};
};

describe("createSessionApi", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("defaults reducerPath to terreno-session", () => {
    const api = createSessionApi();
    expect(api.reducerPath).toBe("terreno-session");
  });

  it("uses a custom reducerPath when provided", () => {
    const api = createSessionApi({reducerPath: "admin-session"});
    expect(api.reducerPath).toBe("admin-session");
  });

  describe("responseHandler", () => {
    it("returns null for a 204 No Content response", async () => {
      setFetch(() => new Response(null, {status: 204}));
      const {store, withEndpoints} = buildStore();

      const result = await store.dispatch(withEndpoints.endpoints.getThing.initiate());

      expect(result.error).toBeUndefined();
      expect(result.data).toBeNull();
    });

    it("returns the whole payload for list responses containing `more`", async () => {
      const payload = {data: [{id: "1"}], more: false, page: 1};
      setFetch(() => jsonResponse(payload));
      const {store, withEndpoints} = buildStore();

      const result = await store.dispatch(withEndpoints.endpoints.getThing.initiate());

      expect(result.data).toEqual(payload);
    });

    it("unwraps the `data` envelope for single-resource responses", async () => {
      setFetch(() => jsonResponse({data: {id: "42", name: "answer"}}));
      const {store, withEndpoints} = buildStore();

      const result = await store.dispatch(withEndpoints.endpoints.getThing.initiate());

      expect(result.data).toEqual({id: "42", name: "answer"});
    });

    it("returns the raw result when there is no `data` envelope or `more` field", async () => {
      setFetch(() => jsonResponse({id: "7", name: "raw"}));
      const {store, withEndpoints} = buildStore();

      const result = await store.dispatch(withEndpoints.endpoints.getThing.initiate());

      expect(result.data).toEqual({id: "7", name: "raw"});
    });
  });

  it("serializes nested query params with qs", async () => {
    setFetch(() => jsonResponse({id: "1"}));
    const {store, withEndpoints} = buildStore();

    await store.dispatch(withEndpoints.endpoints.getWithParams.initiate());

    const requestedUrl = recorded.urls[0];
    expect(requestedUrl).toContain("ids%5B%24in%5D%5B0%5D=1");
    expect(requestedUrl).toContain("status=active");
  });
});
