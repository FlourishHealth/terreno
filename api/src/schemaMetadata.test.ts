import {describe, expect, it} from "bun:test";
import mongoose, {Schema} from "mongoose";

import {describeModel, describeModelForRouter} from "./schemaMetadata";

const fixtureSchema = new Schema({
  completed: {default: false, description: "Whether the item is done", type: Boolean},
  createdAt: {description: "When the record was created", type: Date},
  label: {description: "Display label", required: true, type: String},
  metadata: {description: "Arbitrary metadata", type: Schema.Types.Mixed},
  ownerId: {description: "Owning user", ref: "User", required: true, type: Schema.Types.ObjectId},
  status: {
    description: "Workflow status",
    enum: ["draft", "published"],
    type: String,
  },
  tags: {description: "Search tags", type: [String]},
  tasks: {
    description: "Nested tasks",
    type: [
      new Schema({
        done: {description: "Whether the task is done", type: Boolean},
        title: {description: "Task title", required: true, type: String},
      }),
    ],
  },
});

fixtureSchema.add({
  created: {description: "Created timestamp", type: Date},
  deleted: {default: false, description: "Soft delete flag", type: Boolean},
  updated: {description: "Updated timestamp", type: Date},
});

const FixtureModel =
  mongoose.models.SchemaMetadataFixture ?? mongoose.model("SchemaMetadataFixture", fixtureSchema);

describe("describeModel", () => {
  it("returns a field graph snapshot for the fixture schema", () => {
    const description = describeModel(FixtureModel);

    expect(description.modelName).toBe("SchemaMetadataFixture");
    expect(description.fields).toMatchSnapshot();
  });

  it("marks system fields", () => {
    const description = describeModel(FixtureModel);

    expect(description.fields._id?.system).toBe(true);
    expect(description.fields.__v?.system).toBe(true);
    expect(description.fields.created?.system).toBe(true);
    expect(description.fields.updated?.system).toBe(true);
    expect(description.fields.deleted?.system).toBe(true);
  });

  it("captures enum, ref, array, subdocument, and mixed fields", () => {
    const description = describeModel(FixtureModel);

    expect(description.fields.status).toEqual(
      expect.objectContaining({
        enum: ["draft", "published"],
        kind: "string",
      })
    );
    expect(description.fields.ownerId).toEqual(
      expect.objectContaining({
        kind: "objectId",
        ref: "User",
        required: true,
      })
    );
    expect(description.fields.tags).toEqual(
      expect.objectContaining({
        isArray: true,
        item: expect.objectContaining({kind: "string"}),
      })
    );
    expect(description.fields.tasks).toEqual(
      expect.objectContaining({
        isArray: true,
        item: expect.objectContaining({
          fields: expect.objectContaining({
            done: expect.objectContaining({kind: "boolean"}),
            title: expect.objectContaining({kind: "string", required: true}),
          }),
        }),
      })
    );
    expect(description.fields.metadata).toEqual(
      expect.objectContaining({
        kind: "mixed",
      })
    );
  });
});

describe("describeModelForRouter", () => {
  it("adds write masks from system fields and validation exclusions", () => {
    const description = describeModelForRouter(FixtureModel, {
      validation: {
        excludeFromCreate: ["ownerId"],
        excludeFromUpdate: ["status"],
      },
    });

    expect(description.fields.created?.writableOnCreate).toBe(false);
    expect(description.fields.ownerId?.writableOnCreate).toBe(false);
    expect(description.fields.label?.writableOnCreate).toBe(true);
    expect(description.fields.status?.writableOnUpdate).toBe(false);
    expect(description.fields.label?.writableOnUpdate).toBe(true);
  });
});
