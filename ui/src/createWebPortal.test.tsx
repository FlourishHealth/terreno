import {describe, expect, it} from "bun:test";
import React from "react";

import {createWebPortal} from "./createWebPortal";
import {createWebPortal as createNativePortal} from "./createWebPortal.native";

interface ReactPortalShape {
  children: unknown;
  containerInfo: unknown;
}

describe("createWebPortal (web)", () => {
  it("wraps children in a react-dom portal targeting the container", () => {
    const container = {nodeType: 1} as unknown as Element;
    const children = React.createElement("div", null, "portal-content");

    const portal = createWebPortal({children, container}) as unknown as ReactPortalShape;

    expect(portal).toBeTruthy();
    expect(portal.containerInfo).toBe(container);
    expect(portal.children).toBe(children);
  });
});

describe("createWebPortal (native)", () => {
  it("returns the children unchanged without creating a portal", () => {
    const container = {nodeType: 1} as unknown as Element;
    const children = React.createElement("div", null, "native-content");

    expect(createNativePortal({children, container})).toBe(children);
  });
});
