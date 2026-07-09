import {describe, expect, it} from "bun:test";
import React from "react";

import {createWebPortal} from "./createWebPortal";

describe("createWebPortal", () => {
  it("wraps children in a react-dom portal targeting the container", () => {
    const children = React.createElement("div", null, "portal content");
    const container = {nodeType: 1} as unknown as Element;

    const portal = createWebPortal({children, container}) as unknown as {
      children: unknown;
      containerInfo: unknown;
    };

    expect(portal).toBeTruthy();
    expect(portal.children).toBe(children);
    expect(portal.containerInfo).toBe(container);
  });

  it("targets the provided container when a different one is passed", () => {
    const children = React.createElement("span", null, "other");
    const containerA = {id: "a", nodeType: 1} as unknown as Element;
    const containerB = {id: "b", nodeType: 1} as unknown as Element;

    const portalA = createWebPortal({children, container: containerA}) as unknown as {
      containerInfo: unknown;
    };
    const portalB = createWebPortal({children, container: containerB}) as unknown as {
      containerInfo: unknown;
    };

    expect(portalA.containerInfo).toBe(containerA);
    expect(portalB.containerInfo).toBe(containerB);
  });
});
