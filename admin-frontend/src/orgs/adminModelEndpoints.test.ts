import {describe, it} from "bun:test";
import {assert} from "chai";
import type {EndpointBuilder} from "../types";
import {adminOrganizationHeaders, buildAdminModelEndpoints} from "./adminModelEndpoints";

interface EndpointDefinition {
  query: (args: unknown) => Record<string, unknown>;
}

const build = {
  mutation: (definition: EndpointDefinition): EndpointDefinition => definition,
  query: (definition: EndpointDefinition): EndpointDefinition => definition,
} as unknown as EndpointBuilder;

describe("adminModelEndpoints", () => {
  it("omits organization headers when no organization is selected", () => {
    assert.isUndefined(adminOrganizationHeaders(undefined));
  });

  it("sends X-Organization-Id on list, read, and write endpoints", () => {
    const headers = adminOrganizationHeaders("org-1");
    const endpoints = buildAdminModelEndpoints(build, {
      headers,
      modelName: "Food",
      organizationId: "org-1",
      routePath: "/admin/foods",
    });
    const list = endpoints.adminList_Food as EndpointDefinition;
    const read = endpoints.adminRead_Food as EndpointDefinition;
    const create = endpoints.adminCreate_Food as EndpointDefinition;

    assert.deepEqual(list.query({}).headers, {"X-Organization-Id": "org-1"});
    assert.deepEqual(read.query("food-1").headers, {"X-Organization-Id": "org-1"});
    assert.deepEqual(create.query({name: "Soup"}).headers, {"X-Organization-Id": "org-1"});
  });

  it("rebuilds list cache keys when the selected organization changes", () => {
    const first = buildAdminModelEndpoints(build, {
      headers: adminOrganizationHeaders("org-1"),
      modelName: "Food",
      organizationId: "org-1",
      routePath: "/admin/foods",
    });
    const second = buildAdminModelEndpoints(build, {
      headers: adminOrganizationHeaders("org-2"),
      modelName: "Food",
      organizationId: "org-2",
      routePath: "/admin/foods",
    });
    const firstList = first.adminList_Food as {
      serializeQueryArgs: (args: {endpointName: string; queryArgs: unknown}) => string;
    };
    const secondList = second.adminList_Food as {
      serializeQueryArgs: (args: {endpointName: string; queryArgs: unknown}) => string;
    };

    assert.notEqual(
      firstList.serializeQueryArgs({endpointName: "adminList_Food", queryArgs: {}}),
      secondList.serializeQueryArgs({endpointName: "adminList_Food", queryArgs: {}})
    );
    assert.deepEqual((second.adminList_Food as EndpointDefinition).query({}).headers, {
      "X-Organization-Id": "org-2",
    });
  });
});
