import {afterEach, describe, expect, it} from "bun:test";
import type {Store} from "@reduxjs/toolkit";

import {registerTerrenoDevStore} from "./devStore";

type DevGlobal = typeof globalThis & {
  __DEV__?: boolean;
  __TERRENO_STORE__?: Store<Record<string, unknown>>;
};

const devGlobal = globalThis as DevGlobal;

const makeStore = (state: Record<string, unknown>): Store<Record<string, unknown>> =>
  ({
    dispatch: () => undefined,
    getState: () => state,
    replaceReducer: () => undefined,
    subscribe: () => () => undefined,
  }) as unknown as Store<Record<string, unknown>>;

const originalDev = devGlobal.__DEV__;

afterEach(() => {
  if (originalDev === undefined) {
    delete devGlobal.__DEV__;
  } else {
    devGlobal.__DEV__ = originalDev;
  }
  delete devGlobal.__TERRENO_STORE__;
});

describe("registerTerrenoDevStore", () => {
  it("exposes the store on globalThis in development", () => {
    devGlobal.__DEV__ = true;
    const store = makeStore({auth: {userId: "user-1"}});

    registerTerrenoDevStore(store);

    expect(devGlobal.__TERRENO_STORE__).toBe(store);
    expect(devGlobal.__TERRENO_STORE__?.getState()).toEqual({auth: {userId: "user-1"}});
  });

  it("replaces a previously registered store", () => {
    devGlobal.__DEV__ = true;
    const first = makeStore({count: 1});
    const second = makeStore({count: 2});

    registerTerrenoDevStore(first);
    registerTerrenoDevStore(second);

    expect(devGlobal.__TERRENO_STORE__).toBe(second);
  });

  it("does nothing in production builds", () => {
    devGlobal.__DEV__ = false;

    registerTerrenoDevStore(makeStore({}));

    expect(devGlobal.__TERRENO_STORE__).toBeUndefined();
  });

  it("does nothing when __DEV__ is not defined", () => {
    delete devGlobal.__DEV__;

    registerTerrenoDevStore(makeStore({}));

    expect(devGlobal.__TERRENO_STORE__).toBeUndefined();
  });
});
