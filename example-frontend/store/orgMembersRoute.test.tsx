import {beforeAll, beforeEach, describe, it, mock} from "bun:test";
import {assert} from "chai";
import React from "react";
import {renderToString} from "react-dom/server";

const capturedMembersProps: {
  current?: {api?: unknown; organizationId?: string; routeBase?: string};
} = {};
const mockTerrenoApi = {reducerPath: "example-frontend-members-test-api"};
const searchParamsState: {orgId?: string} = {orgId: "org-42"};

mock.module("@terreno/admin-frontend", () => ({
  OrgMembersScreen: (props: {api?: unknown; organizationId?: string; routeBase?: string}) => {
    capturedMembersProps.current = props;
    return null;
  },
}));
mock.module("expo-router", () => ({
  useLocalSearchParams: () => searchParamsState,
}));
mock.module("@/store/sdk", () => ({
  terrenoApi: mockTerrenoApi,
}));

let OrgMembersRoute: React.FC;

describe("OrgMembersRoute", () => {
  beforeAll(async () => {
    ({default: OrgMembersRoute} = await import("../app/admin/orgs/[orgId]/members"));
  });

  beforeEach(() => {
    searchParamsState.orgId = "org-42";
    capturedMembersProps.current = undefined;
  });

  it("reads orgId from expo-router search params", () => {
    searchParamsState.orgId = "org-acme-99";

    renderToString(<OrgMembersRoute />);

    assert.equal(capturedMembersProps.current?.organizationId, "org-acme-99");
  });

  it("wires OrgMembersScreen with terrenoApi, organizationId, and routeBase", () => {
    renderToString(<OrgMembersRoute />);

    assert.equal(capturedMembersProps.current?.api, mockTerrenoApi);
    assert.equal(capturedMembersProps.current?.organizationId, "org-42");
    assert.equal(capturedMembersProps.current?.routeBase, "/admin");
  });
});
