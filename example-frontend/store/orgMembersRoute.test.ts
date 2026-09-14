import {beforeAll, beforeEach, describe, it, mock} from "bun:test";
import {assert} from "chai";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";

type MockableUseLocalSearchParams = typeof useLocalSearchParams & {
  mockImplementation?: (impl: typeof useLocalSearchParams) => void;
};

const searchParamsState: {orgId?: string} = {orgId: "org-42"};
const capturedMembersProps: {
  current?: {api?: unknown; organizationId?: string; routeBase?: string};
} = {};
const mockTerrenoApi = {reducerPath: "terreno-example-frontend-members-test-api"};

mock.module("@terreno/admin-frontend", () => ({
  OrgMembersScreen: (props: {api?: unknown; organizationId?: string; routeBase?: string}) => {
    capturedMembersProps.current = props;
    return React.createElement("Text", {testID: "org-members-screen-stub"});
  },
}));

let OrgMembersRoute: React.FC;

beforeAll(async () => {
  const membersModuleUrl = new URL("../app/admin/orgs/[orgId]/members.tsx", import.meta.url);
  const sdkPath = new URL("../../../../store/sdk.ts", membersModuleUrl).pathname;

  mock.module(sdkPath, () => ({
    terrenoApi: mockTerrenoApi,
  }));
  ({default: OrgMembersRoute} = await import("../app/admin/orgs/[orgId]/members"));
});

beforeEach(() => {
  searchParamsState.orgId = "org-42";
  const useLocalSearchParamsMock = useLocalSearchParams as MockableUseLocalSearchParams;
  useLocalSearchParamsMock.mockImplementation?.(() => searchParamsState);
  capturedMembersProps.current = undefined;
});

describe("OrgMembersRoute", () => {
  it("reads orgId from expo-router search params", () => {
    searchParamsState.orgId = "org-acme-99";

    renderWithTheme(React.createElement(OrgMembersRoute));

    assert.equal(capturedMembersProps.current?.organizationId, "org-acme-99");
  });

  it("wires OrgMembersScreen with terrenoApi, organizationId, and routeBase", () => {
    renderWithTheme(React.createElement(OrgMembersRoute));

    assert.equal(capturedMembersProps.current?.api, mockTerrenoApi);
    assert.equal(capturedMembersProps.current?.organizationId, "org-42");
    assert.equal(capturedMembersProps.current?.routeBase, "/admin");
  });
});
