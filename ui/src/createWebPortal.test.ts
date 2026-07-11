import {describe, expect, it, mock} from "bun:test";
import React, {type ReactElement} from "react";

const portalElement = React.createElement("portal");
const createPortal = mock((_children: ReactElement, _container: Element) => portalElement);

mock.module("react-dom", () => ({createPortal}));

const {createWebPortal} = await import("./createWebPortal");

describe("createWebPortal", () => {
  it("creates a portal in the requested container", () => {
    const children = React.createElement("span", null, "Portal content");
    const container = {} as Element;

    expect(createWebPortal({children, container})).toBe(portalElement);
    expect(createPortal).toHaveBeenCalledWith(children, container);
  });
});
