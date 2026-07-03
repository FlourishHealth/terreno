// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it} from "bun:test";
import mongoose, {type Document, type HydratedDocument, Schema} from "mongoose";

import {fixMixedFields, getOpenApiSpecForModel, unpopulate} from "./populate";
import {FoodModel, setupTestData, type User, UserModel} from "./tests";

describe("populate functions", () => {
  let admin: HydratedDocument<User>;
  let notAdmin: HydratedDocument<User>;

  // noExplicitAny: typing as HydratedDocument<Food> causes cascading errors on populated field access patterns (e.g. populated.ownerId.name)
  let spinach: any;

  beforeEach(async () => {
    const testData = await setupTestData();
    admin = testData.users.admin;
    notAdmin = testData.users.notAdmin;
    spinach = testData.foods.spinach;
  });

  it("unpopulate", async () => {
    let populated = await spinach.populate("ownerId");
    populated = await populated.populate("eatenBy");
    populated = await populated.populate("likesIds.userId");
    expect(populated.ownerId.name).toBe("Not Admin");
    expect(populated.eatenBy[0].id).toBe(admin.id);
    expect(populated.eatenBy[0].name).toBe("Admin");
    expect(populated.likesIds[0].userId.id).toBe(admin.id);
    expect(populated.likesIds[0].userId.name).toBe("Admin");
    expect(populated.likesIds[1].userId.id).toBe(notAdmin.id);
    expect(populated.likesIds[1].userId.name).toBe("Not Admin");

    // noExplicitAny: unpopulate returns Document<T> which doesn't expose model properties; would require refactoring the return type
    let unpopulated: any = unpopulate(populated, "ownerId");
    expect(spinach.ownerId.name).toBeUndefined();
    expect(unpopulated.ownerId.toString()).toBe(notAdmin.id);
    // Ensure nothing else was touched.
    expect(populated.likesIds[0].userId.id).toBe(admin.id);
    expect(populated.likesIds[0].userId.name).toBe("Admin");
    expect(populated.likesIds[1].userId.id).toBe(notAdmin.id);
    expect(populated.likesIds[1].userId.name).toBe("Not Admin");

    unpopulated = unpopulate(populated, "eatenBy");
    expect(populated.eatenBy.toString()).toBe(admin.id);
    expect(populated.eatenBy[0]?.name).toBeUndefined();

    unpopulated = unpopulate(populated, "likesIds.userId");
    expect(populated.likesIds[0].userId.toString()).toBe(admin.id);
    expect(populated.likesIds[0].userId?.name).toBeUndefined();
    expect(populated.likesIds[1].userId.toString()).toBe(notAdmin.id);
    expect(populated.likesIds[1].userId.name).toBeUndefined();
  });
});

describe("unpopulate edge cases", () => {
  it("throws error when path is empty", () => {
    const doc = {name: "test"};
    expect(() => unpopulate(doc as unknown as Document<unknown>, "")).toThrow("path is required");
  });

  it("unpopulates single populated field", () => {
    const doc = {
      name: "test",
      ownerId: {_id: "owner-123", email: "owner@test.com"},
    };
    const result = unpopulate(doc as unknown as Document<unknown>, "ownerId") as unknown as {
      ownerId: string;
    };
    expect(result.ownerId).toBe("owner-123");
  });

  it("unpopulates array of populated fields", () => {
    const doc = {
      items: [{_id: "item-1", name: "Item 1"}, {_id: "item-2", name: "Item 2"}, "item-3"],
      name: "test",
    };
    const result = unpopulate(doc as unknown as Document<unknown>, "items") as unknown as {
      items: string[];
    };
    expect(result.items).toEqual(["item-1", "item-2", "item-3"]);
  });

  it("handles nested paths", () => {
    const doc = {
      name: "test",
      nested: {
        items: [
          {_id: "item-1", name: "Item 1"},
          {_id: "item-2", name: "Item 2"},
        ],
      },
    };
    const result = unpopulate(doc as unknown as Document<unknown>, "nested.items") as unknown as {
      nested: {items: string[]};
    };
    expect(result.nested.items).toEqual(["item-1", "item-2"]);
  });

  it("returns original doc when path does not exist", () => {
    const doc = {name: "test"};
    const result = unpopulate(doc as unknown as Document<unknown>, "nonexistent") as unknown as {
      name: string;
    };
    expect(result).toEqual(doc);
  });

  it("handles nested array paths", () => {
    const doc = {
      containers: [
        {items: [{_id: "item-1"}, {_id: "item-2"}]},
        {items: [{_id: "item-3"}, {_id: "item-4"}]},
      ],
      name: "test",
    };
    const result = unpopulate(
      doc as unknown as Document<unknown>,
      "containers.items"
    ) as unknown as {containers: {items: string[]}[]};
    expect(result.containers[0].items).toEqual(["item-1", "item-2"]);
    expect(result.containers[1].items).toEqual(["item-3", "item-4"]);
  });
});

describe("fixMixedFields", () => {
  it("returns early when schema is missing", () => {
    const properties = {foo: {type: "object"}};
    expect(() => fixMixedFields(null, properties)).not.toThrow();
  });

  it("returns early when properties is missing", () => {
    const schema = new Schema({});
    expect(() => fixMixedFields(schema, null as unknown as Record<string, unknown>)).not.toThrow();
  });

  it("replaces Mixed fields with only description", () => {
    const schema = new Schema({data: {description: "any data", type: Schema.Types.Mixed}});
    const properties: Record<string, Record<string, unknown>> = {
      data: {description: "any data", type: "object"},
    };
    fixMixedFields(schema, properties);
    expect(properties.data).toEqual({description: "any data"});
  });

  it("recurses into arrays of sub-documents", () => {
    const subSchema = new Schema({meta: {type: Schema.Types.Mixed}});
    const schema = new Schema({items: [subSchema]});
    const properties = {
      items: {
        items: {
          properties: {
            meta: {type: "object"} as Record<string, unknown>,
          },
        },
        type: "array" as const,
      },
    };
    fixMixedFields(schema, properties);
    expect(properties.items.items.properties.meta).toEqual({description: undefined});
  });

  it("skips unknown paths", () => {
    const schema = new Schema({foo: String});
    const properties = {unknownKey: {type: "string"}};
    expect(() => fixMixedFields(schema, properties)).not.toThrow();
  });
});

describe("getOpenApiSpecForModel edge cases", () => {
  it("returns model properties without populatePaths", () => {
    const result = getOpenApiSpecForModel(UserModel);
    expect(result.properties).toBeDefined();
  });

  it("returns with extraModelProperties merged", () => {
    const result = getOpenApiSpecForModel(UserModel, {
      extraModelProperties: {customField: {type: "string"}},
    });
    expect(result.properties.customField).toEqual({type: "string"});
  });

  it("skips populate paths without ref", () => {
    // Create a schema with a non-referenced ObjectId field
    const testSchema = new Schema({name: String, simpleId: Schema.Types.ObjectId});
    const TestModelNoRef =
      mongoose.models.TestModelNoRef || mongoose.model("TestModelNoRef", testSchema);
    const result = getOpenApiSpecForModel(TestModelNoRef, {
      populatePaths: [{path: "simpleId"}],
    });
    // Should not throw, simpleId stays as-is
    expect(result.properties).toBeDefined();
  });

  it("populates with fields allowlist", () => {
    const result = getOpenApiSpecForModel(FoodModel, {
      populatePaths: [{fields: ["name"], path: "ownerId"}],
    });
    expect(result.properties).toBeDefined();
  });

  it("uses openApiComponent $ref when provided", () => {
    const result = getOpenApiSpecForModel(FoodModel, {
      populatePaths: [{openApiComponent: "UserComponent", path: "ownerId"}],
    });
    expect(result.properties.ownerId).toEqual({
      $ref: "#/components/schemas/UserComponent",
    });
  });

  it("populates array ref fields (eatenBy)", () => {
    const result = getOpenApiSpecForModel(FoodModel, {
      populatePaths: [{path: "eatenBy"}],
    });
    expect(result.properties.eatenBy).toBeDefined();
    expect((result.properties.eatenBy as Record<string, unknown>).items).toBeDefined();
  });

  it("populates nested ref in sub-schema (likesIds.userId)", () => {
    const result = getOpenApiSpecForModel(FoodModel, {
      populatePaths: [{path: "likesIds.userId"}],
    });
    expect(result.properties.likesIds).toBeDefined();
  });

  it("includes virtuals from model schema", () => {
    const result = getOpenApiSpecForModel(FoodModel);
    expect(result.properties.description).toBeDefined();
    expect((result.properties.description as Record<string, unknown>).type).toBe("any");
  });

  it("includes virtuals from child schemas", () => {
    const childSub = new Schema({amount: {description: "Amount", type: Number}});
    childSub.virtual("displayAmount").get(function () {
      return `${this.amount} units`;
    });
    const parentSchema = new Schema({
      detail: {description: "Single embedded detail", type: childSub},
      title: {description: "Title", type: String},
    });
    const ParentModel =
      mongoose.models.ParentWithChildVirtual ||
      mongoose.model("ParentWithChildVirtual", parentSchema);
    const result = getOpenApiSpecForModel(ParentModel);
    const detail = result.properties.detail as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    expect(detail.properties.displayAmount).toBeDefined();
    expect(detail.properties.displayAmount.type).toBe("any");
  });
});

describe("getOpenApiSpecForModel populate with existing properties", () => {
  it("merges populated properties into a path that already has properties", () => {
    const result = getOpenApiSpecForModel(FoodModel, {
      populatePaths: [{path: "likesIds.userId"}],
    });
    // likesIds is an array subschema with its own properties already;
    // populating userId should merge the user properties into the existing structure.
    expect(result.properties.likesIds).toBeDefined();
    const likesIds = result.properties.likesIds as Record<string, unknown>;
    const items = likesIds.items as Record<string, Record<string, unknown>>;
    expect(items.properties.userId).toBeDefined();
  });

  it("creates intermediate path structure when navigating to nested populate", () => {
    // eatenBy is defined as [{ ref: "User", type: ObjectId }] - an array of refs.
    // When we populate eatenBy, the openApiPath resolves through items.
    const result = getOpenApiSpecForModel(FoodModel, {
      populatePaths: [{path: "eatenBy"}],
    });
    expect(result.properties.eatenBy).toBeDefined();
    const eatenBy = result.properties.eatenBy as Record<string, unknown>;
    expect(eatenBy.items).toBeDefined();
  });
});

describe("getOpenApiSpecForModel populate property merge", () => {
  it("merges properties when the same path is populated twice", () => {
    // First populate sets the field properties, second triggers the merge branch.
    const result = getOpenApiSpecForModel(FoodModel, {
      populatePaths: [{fields: ["name"], path: "likesIds.userId"}, {path: "likesIds.userId"}],
    });
    const likesIds = result.properties.likesIds as Record<string, unknown>;
    const items = likesIds.items as Record<string, Record<string, unknown>>;
    const userIdProps = items.properties.userId as Record<string, Record<string, unknown>>;
    // After the merge the wider populate should have contributed all user fields.
    expect(userIdProps.properties).toBeDefined();
    expect(userIdProps.properties.name).toBeDefined();
  });

  it("merges openApiComponent ref into an already-populated path", () => {
    const result = getOpenApiSpecForModel(FoodModel, {
      populatePaths: [
        {path: "likesIds.userId"},
        {openApiComponent: "UserComponent", path: "likesIds.userId"},
      ],
    });
    const likesIds = result.properties.likesIds as Record<string, unknown>;
    const items = likesIds.items as Record<string, Record<string, unknown>>;
    const userIdProps = items.properties.userId as Record<string, Record<string, unknown>>;
    // Merge path adds the $ref key inside the existing properties.
    expect(userIdProps.properties).toBeDefined();
    expect(userIdProps.properties.userId).toEqual({
      $ref: "#/components/schemas/UserComponent",
    });
  });
});

describe("filterKeys (via getOpenApiSpecForModel populatePaths)", () => {
  it("filters populated fields using dot-notation keys", () => {
    const result = getOpenApiSpecForModel(FoodModel, {
      populatePaths: [{fields: ["name.nested"], path: "ownerId"}],
    });
    const ownerProps = (result.properties.ownerId as Record<string, unknown>).properties as Record<
      string,
      unknown
    >;
    expect(ownerProps.name).toBeDefined();
    expect(typeof ownerProps.name).toBe("object");
  });

  it("rejects prototype pollution keys in nested dot-notation", () => {
    const result = getOpenApiSpecForModel(FoodModel, {
      populatePaths: [{fields: ["__proto__.polluted"], path: "ownerId"}],
    });
    expect(result.properties).toBeDefined();
    // noExplicitAny: testing that prototype pollution did not add a 'polluted' property to Object.prototype
    expect((Object.prototype as any).polluted).toBeUndefined();
    const ownerProps = (result.properties.ownerId as Record<string, unknown>).properties as Record<
      string,
      unknown
    >;
    expect(ownerProps).toBeDefined();
    expect(Object.keys(ownerProps)).not.toContain("__proto__");
  });
});
