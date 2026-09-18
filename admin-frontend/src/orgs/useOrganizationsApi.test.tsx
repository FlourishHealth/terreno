import {describe, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";
import {assert} from "chai";
import type {AdminApi, EndpointBuilder} from "../types";
import {useOrganizationsApi} from "./useOrganizationsApi";

interface CapturedQuery {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  method: string;
  url: string;
}

interface CapturedEndpoint {
  invalidatesTags?: string[] | unknown;
  providesTags?: unknown;
  query: (arg: never) => CapturedQuery;
}

/**
 * Stands in for the host RTK Query API. `injectEndpoints` is invoked eagerly so the
 * endpoint definitions can be asserted, then hook names are returned the way RTK Query
 * generates them from endpoint keys.
 */
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
        useOrgCreateMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
        useOrgDeleteMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
        useOrgListQuery: mock(() => ({isLoading: false})),
        useOrgMemberAttachMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
        useOrgMemberRemoveMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
        useOrgMembersQuery: mock(() => ({isLoading: false})),
        useOrgMemberUpdateMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
        useOrgMineQuery: mock(() => ({isLoading: false})),
        useOrgReadQuery: mock(() => ({isLoading: false})),
        useOrgUpdateMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
      };
    },
  } as unknown as AdminApi;
  return {addTagTypes, api, endpoints};
};

describe("useOrganizationsApi", () => {
  it("injects every organization endpoint against the base path", () => {
    const {addTagTypes, api, endpoints} = createApiDouble();
    const {result} = renderHook(() => useOrganizationsApi(api, "/custom-orgs", "org-ctx"));

    assert.deepEqual(addTagTypes[0], ["organizations", "organization-members"]);
    assert.deepEqual(endpoints.orgCreate.query({name: "Acme"} as never), {
      body: {name: "Acme"},
      method: "POST",
      url: "/custom-orgs",
    });
    assert.deepEqual(endpoints.orgDelete.query("org-1" as never), {
      method: "DELETE",
      url: "/custom-orgs/org-1",
    });
    assert.deepEqual(endpoints.orgList.query(undefined as never), {
      method: "GET",
      url: "/custom-orgs",
    });
    assert.deepEqual(endpoints.orgMine.query(undefined as never), {
      method: "GET",
      url: "/custom-orgs/mine",
    });
    assert.deepEqual(endpoints.orgRead.query("org-1" as never), {
      headers: {"X-Organization-Id": "org-1"},
      method: "GET",
      url: "/custom-orgs/org-1",
    });
    assert.deepEqual(endpoints.orgUpdate.query({body: {name: "Acme"}, id: "org-1"} as never), {
      body: {name: "Acme"},
      headers: {"X-Organization-Id": "org-1"},
      method: "PATCH",
      url: "/custom-orgs/org-1",
    });
    assert.deepEqual(
      endpoints.orgMemberAttach.query({body: {email: "a@b.com"}, id: "org-1"} as never),
      {
        body: {email: "a@b.com"},
        headers: {"X-Organization-Id": "org-1"},
        method: "POST",
        url: "/custom-orgs/org-1/members",
      }
    );
    assert.deepEqual(endpoints.orgMembers.query("org-1" as never), {
      headers: {"X-Organization-Id": "org-1"},
      method: "GET",
      url: "/custom-orgs/org-1/members",
    });
    assert.deepEqual(
      endpoints.orgMemberUpdate.query({
        body: {roleName: "member"},
        id: "org-1",
        memberId: "membership-1",
      } as never),
      {
        body: {roleName: "member"},
        headers: {"X-Organization-Id": "org-1"},
        method: "PATCH",
        url: "/custom-orgs/org-1/members/membership-1",
      }
    );
    assert.deepEqual(
      endpoints.orgMemberRemove.query({
        body: {},
        id: "org-1",
        memberId: "membership-1",
      } as never),
      {
        headers: {"X-Organization-Id": "org-1"},
        method: "DELETE",
        url: "/custom-orgs/org-1/members/membership-1",
      }
    );

    assert.exists(result.current.useCreateMutation);
    assert.exists(result.current.useDeleteMutation);
    assert.exists(result.current.useListQuery);
    assert.exists(result.current.useMemberAttachMutation);
    assert.exists(result.current.useMemberRemoveMutation);
    assert.exists(result.current.useMembersQuery);
    assert.exists(result.current.useMemberUpdateMutation);
    assert.exists(result.current.useMineQuery);
    assert.exists(result.current.useReadQuery);
    assert.exists(result.current.useUpdateMutation);
  });

  it("tags collection and membership endpoints for cache invalidation", () => {
    const {api, endpoints} = createApiDouble();
    renderHook(() => useOrganizationsApi(api));

    assert.deepEqual(endpoints.orgCreate.invalidatesTags, ["organizations"]);
    assert.deepEqual(endpoints.orgDelete.invalidatesTags, ["organizations"]);
    assert.deepEqual(endpoints.orgUpdate.invalidatesTags, ["organizations"]);
    assert.deepEqual(endpoints.orgList.providesTags, ["organizations"]);
    assert.deepEqual(endpoints.orgMine.providesTags, ["organizations"]);
    assert.deepEqual(endpoints.orgRead.providesTags, ["organizations"]);
    assert.deepEqual(endpoints.orgMemberAttach.invalidatesTags, ["organization-members"]);
    assert.deepEqual(endpoints.orgMemberRemove.invalidatesTags, ["organization-members"]);
    assert.deepEqual(endpoints.orgMemberUpdate.invalidatesTags, ["organization-members"]);
    assert.deepEqual(endpoints.orgMembers.providesTags, ["organization-members"]);
  });
});
