import {describe, it} from "bun:test";
import {assert} from "chai";

import {buildAdminApiListQueryRequest} from "./adminApiQueryParams";

describe("serializeAdminApiQueryParams", () => {
  it("serializes scalar choice filters", () => {
    const serialized = buildAdminApiListQueryRequest("/admin/todos", {
      limit: 25,
      page: 1,
      priority: "high",
    }).url;
    assert.include(serialized, "priority=high");
    assert.include(serialized, "limit=25");
    assert.notInclude(serialized, "object");
  });

  it("serializes empty-only choice filters with bracketed $in keys", () => {
    const serialized = buildAdminApiListQueryRequest("/admin/todos", {
      limit: 25,
      page: 1,
      priority: {$in: ["__empty__"]},
    }).url;
    assert.include(decodeURIComponent(serialized), "priority[$in][0]=__empty__");
    assert.notInclude(serialized, "object");
  });

  it("serializes multi-choice $in filters with bracketed keys", () => {
    const serialized = buildAdminApiListQueryRequest("/admin/todos", {
      status: {$in: ["open", "closed"]},
    }).url;
    assert.include(decodeURIComponent(serialized), "status[$in][0]=open");
    assert.include(decodeURIComponent(serialized), "status[$in][1]=closed");
  });

  it("serializes empty plus concrete choice values in one $in", () => {
    const serialized = buildAdminApiListQueryRequest("/admin/todos", {
      priority: {$in: ["high", "__empty__"]},
    }).url;
    assert.include(decodeURIComponent(serialized), "priority[$in][0]=high");
    assert.include(decodeURIComponent(serialized), "priority[$in][1]=__empty__");
  });
});

describe("buildAdminApiListQueryUrl", () => {
  it("embeds serialized nested params in the URL instead of RTK params", () => {
    const url = buildAdminApiListQueryRequest("/admin/todos", {
      limit: 25,
      page: 1,
      priority: {$in: ["__empty__"]},
    }).url;
    assert.isTrue(url.startsWith("/admin/todos?"));
    assert.include(decodeURIComponent(url), "priority[$in][0]=__empty__");
    assert.notInclude(url, "[object Object]");
  });
});

describe("buildAdminApiListQueryRequest", () => {
  it("leaves the route unchanged when there are no serializable params", () => {
    assert.deepEqual(buildAdminApiListQueryRequest("/admin/todos", undefined), {
      method: "GET",
      url: "/admin/todos",
    });
    assert.deepEqual(buildAdminApiListQueryRequest("/admin/todos", {priority: undefined}), {
      method: "GET",
      url: "/admin/todos",
    });
  });

  it("returns a GET url with qs-serialized nested filters and no params object", () => {
    const listRequest = buildAdminApiListQueryRequest("/admin/todos", {
      limit: 25,
      page: 1,
      priority: {$in: ["__empty__"]},
    });

    assert.equal(listRequest.method, "GET");
    assert.include(decodeURIComponent(listRequest.url), "priority[$in][0]=__empty__");
    assert.notInclude(listRequest.url, "[object Object]");
  });

  it("documents default URLSearchParams coercion that breaks nested operators", () => {
    const broken = new URLSearchParams({
      priority: String({$in: ["__empty__"]}),
    }).toString();
    assert.equal(broken, "priority=%5Bobject+Object%5D");
  });
});
