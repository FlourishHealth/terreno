import {describe, expect, it} from "bun:test";

import {adaptPersister} from "./adapt";
import type {RawPersister} from "./types";

const createRecordingPersister = (): {raw: RawPersister; calls: string[]} => {
  const calls: string[] = [];
  const self = {} as RawPersister;
  const raw: RawPersister = {
    destroy: () => {
      calls.push("destroy");
      return self;
    },
    load: async () => {
      calls.push("load");
      return self;
    },
    save: async () => {
      calls.push("save");
      return self;
    },
    startAutoSave: async () => {
      calls.push("startAutoSave");
      return self;
    },
    stopAutoSave: () => {
      calls.push("stopAutoSave");
      return self;
    },
  };
  return {calls, raw};
};

describe("adaptPersister", () => {
  it("delegates every method and resolves to void", async () => {
    const {calls, raw} = createRecordingPersister();
    const persister = adaptPersister(raw);

    await expect(persister.load()).resolves.toBeUndefined();
    await expect(persister.save()).resolves.toBeUndefined();
    await expect(persister.startAutoSave()).resolves.toBeUndefined();
    persister.stopAutoSave();
    persister.destroy();

    expect(calls).toEqual(["load", "save", "startAutoSave", "stopAutoSave", "destroy"]);
  });
});
