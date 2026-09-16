import {describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";
import type {AdminApi, EndpointBuilder} from "./types";
import {useAdminMigrations} from "./useAdminMigrations";

interface CapturedQuery {
  method: string;
  url: string;
}

interface CapturedEndpoint {
  invalidatesTags?: string[];
  providesTags?: unknown;
  query: (arg: never) => CapturedQuery;
}

const createApiDouble = (): {
  addTagTypes: string[][];
  api: AdminApi;
  endpoints: Record<string, CapturedEndpoint>;
} => {
  const endpoints: Record<string, CapturedEndpoint> = {};
  const addTagTypes: string[][] = [];
  const api = {
    enhanceEndpoints: ({addTagTypes: tags}: {addTagTypes: string[]}) => {
      addTagTypes.push(tags);
      return api;
    },
    injectEndpoints: ({
      endpoints: build,
    }: {
      endpoints: (builder: EndpointBuilder) => Record<string, CapturedEndpoint>;
    }) => {
      const builder = {
        mutation: (spec: CapturedEndpoint) => spec,
        query: (spec: CapturedEndpoint) => spec,
      } as unknown as EndpointBuilder;
      Object.assign(endpoints, build(builder));
      return {
        useAdminGetMigrationsQuery: mock(() => ({isLoading: false})),
        useAdminRunMigrationsMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
      };
    },
  } as unknown as AdminApi & {injectEndpoints: unknown};
  return {addTagTypes, api: api as AdminApi, endpoints};
};

describe("useAdminMigrations", () => {
  it("injects status and run endpoints against the admin migrations path", () => {
    const {addTagTypes, api, endpoints} = createApiDouble();
    const {result} = renderHook(() => useAdminMigrations(api, "/admin"));

    expect(addTagTypes[0]).toEqual(["admin_migrations"]);
    expect(endpoints.adminGetMigrations.query(undefined as never)).toEqual({
      method: "GET",
      url: "/admin/migrations/status",
    });
    expect(endpoints.adminRunMigrations.query({wetRun: true} as never)).toEqual({
      method: "POST",
      url: "/admin/migrations/run?wetRun=true",
    });
    expect(result.current.useGetMigrationsQuery).toBeDefined();
    expect(result.current.useRunMigrationsMutation).toBeDefined();
  });

  it("falls back when injectEndpoints is missing", async () => {
    const {result} = renderHook(() => useAdminMigrations({} as AdminApi, "/admin"));
    const query = result.current.useGetMigrationsQuery();
    expect(query.data).toBeUndefined();
    expect(query.isLoading).toBe(false);
    const [run, state] = result.current.useRunMigrationsMutation();
    expect(state.isLoading).toBe(false);
    await expect(run({wetRun: false}).unwrap()).resolves.toEqual({taskId: ""});
  });
});
