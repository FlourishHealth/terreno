import {describe, expect, it} from "bun:test";
import mongoose from "mongoose";
import {ensureAllIndexes} from "./ensureAllIndexes";
import {timeout} from "./timeout";
import {waitForDocument, waitForDocuments} from "./waitForDocuments";

const Widget =
  mongoose.models.CoverageWidget ??
  mongoose.model(
    "CoverageWidget",
    new mongoose.Schema({name: {required: true, type: String}}, {collection: "coverage_widgets"})
  );

describe("timeout", () => {
  it("resolves after the requested delay", async () => {
    await timeout(1);
  });
});

describe("ensureAllIndexes", () => {
  it("creates indexes for registered models", async () => {
    await ensureAllIndexes();
  });
});

describe("waitForDocuments", () => {
  it("returns matching documents and supports sort", async () => {
    await Widget.deleteMany({});
    await Widget.create({name: "b"});
    await Widget.create({name: "a"});
    const docs = await waitForDocuments(Widget, {}, 2, {
      intervalMs: 10,
      sort: {name: 1},
      timeoutMs: 2000,
    });
    expect(docs.map((doc) => (doc as {name: string}).name)).toEqual(["a", "b"]);
    const one = await waitForDocument(Widget, {name: "a"}, {intervalMs: 10, timeoutMs: 2000});
    expect((one as {name: string}).name).toBe("a");
  });

  it("throws when the timeout elapses", async () => {
    await expect(
      waitForDocuments(Widget, {name: "missing-coverage-doc"}, 1, {intervalMs: 5, timeoutMs: 20})
    ).rejects.toThrow(/Timed out/);
  });
});
