import {describe, expect, it} from "bun:test";
import mongoose, {Schema} from "mongoose";
import {z} from "zod";

import {generateInputSchema, generateToolDescription} from "./schemaGenerator";
import type {MCPConfig} from "./types";

const createTestModel = () => {
  const schema = new Schema({
    completed: {default: false, description: "Whether the item is complete", type: Boolean},
    count: {description: "A count", type: Number},
    name: {description: "The name", required: true, type: String},
    ownerId: {description: "Owner", ref: "User", type: Schema.Types.ObjectId},
    secretField: {description: "A secret", type: String},
    status: {description: "Status", enum: ["active", "inactive"], type: String},
    tags: {description: "Tags", type: [String]},
  });

  // Create model if it doesn't already exist
  try {
    return mongoose.model("MCPTestItem");
  } catch {
    return mongoose.model("MCPTestItem", schema);
  }
};

describe("generateInputSchema", () => {
  const model = createTestModel();
  const config: MCPConfig = {};

  it("generates create schema with required fields", () => {
    const schema = generateInputSchema(model, "create", config);
    // Should be a ZodObject
    expect(schema).toBeDefined();

    // Parse valid input
    const result = schema.safeParse({name: "test"});
    expect(result.success).toBe(true);
  });

  it("generates create schema that rejects missing required fields", () => {
    const schema = generateInputSchema(model, "create", config);
    const result = schema.safeParse({completed: true});
    expect(result.success).toBe(false);
  });

  it("generates read schema with id", () => {
    const schema = generateInputSchema(model, "read", config);
    const result = schema.safeParse({id: "507f1f77bcf86cd799439011"});
    expect(result.success).toBe(true);
  });

  it("generates list schema with pagination", () => {
    const schema = generateInputSchema(model, "list", config, ["status", "completed"]);
    const result = schema.safeParse({limit: 10, page: 1, status: "active"});
    expect(result.success).toBe(true);
  });

  it("generates update schema with id required", () => {
    const schema = generateInputSchema(model, "update", config);
    const result = schema.safeParse({id: "507f1f77bcf86cd799439011", name: "updated"});
    expect(result.success).toBe(true);
  });

  it("generates delete schema with id only", () => {
    const schema = generateInputSchema(model, "delete", config);
    const result = schema.safeParse({id: "507f1f77bcf86cd799439011"});
    expect(result.success).toBe(true);
  });

  it("excludes fields when excludeFields is set", () => {
    const configWithExcludes: MCPConfig = {excludeFields: ["secretField"]};
    const schema = generateInputSchema(model, "create", configWithExcludes);

    // Should accept input without secretField
    const result = schema.safeParse({name: "test"});
    expect(result.success).toBe(true);

    // secretField should not cause any error if present (zod strips unknown by default)
    // but shouldn't be in the schema
    const jsonSchema = z.toJSONSchema(schema);
    expect((jsonSchema as any).properties?.secretField).toBeUndefined();
  });

  it("respects maxLimit in list description", () => {
    const configWithLimit: MCPConfig = {maxLimit: 25};
    const schema = generateInputSchema(model, "list", configWithLimit);
    const jsonSchema = z.toJSONSchema(schema);
    const limitDesc = (jsonSchema as any).properties?.limit?.description;
    expect(limitDesc).toContain("25");
  });
});

describe("generateToolDescription", () => {
  const model = createTestModel();

  it("generates list description with query fields", () => {
    const desc = generateToolDescription(model, "list", {}, ["status", "completed"]);
    expect(desc).toContain("List MCPTestItem");
    expect(desc).toContain("status");
    expect(desc).toContain("completed");
  });

  it("generates create description with field types and required info", () => {
    const desc = generateToolDescription(model, "create", {});
    expect(desc).toContain("Create");
    expect(desc).toContain("name (String) required");
    expect(desc).toContain("completed (Boolean)");
  });

  it("includes enum values in create description", () => {
    const desc = generateToolDescription(model, "create", {});
    expect(desc).toContain("status (enum: active|inactive)");
  });

  it("includes ref model name in create description", () => {
    const desc = generateToolDescription(model, "create", {});
    expect(desc).toContain("ownerId (ref: User)");
  });

  it("generates read description with populate-able refs", () => {
    const desc = generateToolDescription(model, "read", {});
    expect(desc).toContain("Read a single MCPTestItem");
    expect(desc).toContain("ownerId (User)");
  });

  it("generates update description with updatable field names", () => {
    const desc = generateToolDescription(model, "update", {});
    expect(desc).toContain("Update");
    expect(desc).toContain("Updatable fields:");
    expect(desc).toContain("name");
  });

  it("uses custom description when provided", () => {
    const desc = generateToolDescription(model, "list", {description: "Custom items"});
    expect(desc).toContain("Custom items");
  });

  it("excludes fields from description when excludeFields set", () => {
    const desc = generateToolDescription(model, "list", {excludeFields: ["status"]}, [
      "status",
      "completed",
    ]);
    expect(desc).not.toContain("status");
    expect(desc).toContain("completed");
  });

  it("excludes fields from create description", () => {
    const desc = generateToolDescription(model, "create", {excludeFields: ["secretField"]});
    expect(desc).not.toContain("secretField");
  });
});
