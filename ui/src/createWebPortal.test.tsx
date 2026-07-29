import {describe, expect, it} from "bun:test";
import {assert} from "chai";
import React from "react";

import {createWebPortal} from "./createWebPortal";
import {createWebPortal as createNativePortal} from "./createWebPortal.native";

describe("createWebPortal (web)", () => {
  it("creates a portal targeting the provided container", () => {
    const container = {nodeType: 1} as unknown as Element;
    const children = React.createElement("div", null, "web-content");

    const portal = createWebPortal({children, container}) as unknown as {
      children: unknown;
      containerInfo: unknown;
    };

    assert.strictEqual(portal.children, children);
    assert.strictEqual(portal.containerInfo, container);
  });
});

describe("createWebPortal (native)", () => {
  it("returns the children unchanged without creating a portal", () => {
    const container = {nodeType: 1} as unknown as Element;
    const children = React.createElement("div", null, "native-content");

    expect(createNativePortal({children, container})).toBe(children);
  });
});
