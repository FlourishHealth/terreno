import {describe, expect, it} from "bun:test";
import mongoose from "mongoose";

describe("AI test preload", () => {
  it("provides a connected MongoDB without requiring a local service", () => {
    const hasExternalMongo = Boolean(process.env.TERRENO_TEST_MONGODB_URI?.trim());

    expect(hasExternalMongo || process.env.TERRENO_TEST_USE_MEMORY_MONGO === "true").toBe(true);
    expect(mongoose.connection.readyState).toBe(1);
  });
});
